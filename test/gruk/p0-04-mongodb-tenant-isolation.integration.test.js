'use strict';

// Run only against a dedicated disposable MongoDB instance:
// GRUK_TEST_MONGO_DISPOSABLE=1 GRUK_TEST_MONGO_URI=mongodb://127.0.0.1:27017/ node --test test/gruk/p0-04-mongodb-tenant-isolation.integration.test.js
// Never point this test at production. It creates and drops an isolated database.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

const uri = process.env.GRUK_TEST_MONGO_URI;
// A database-less URI is NOT evidence that the server is disposable. Restrict
// destructive dropDatabase() tests to loopback, with explicit opt-in.
function isSafeDisposableMongoUri(value, enabled) {
  if (enabled !== '1' || typeof value !== 'string') return false;
  let parsed;
  try { parsed = new URL(value); } catch { return false; }
  if (parsed.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) return false;
  if (parsed.pathname !== '/' && parsed.pathname !== '') return false;
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return false;
  return true;
}
test('P0-04: destructive integration guard rejects unsafe MongoDB targets', () => {
  const allowed = 'mongodb://127.0.0.1:27017/';
  assert.equal(isSafeDisposableMongoUri(allowed, undefined), false);
  assert.equal(isSafeDisposableMongoUri(allowed, '0'), false);
  assert.equal(isSafeDisposableMongoUri(allowed, '1'), true);
  for (const unsafe of [
    'mongodb+srv://cluster.example.com/',
    'mongodb://mongo.example.com:27017/',
    'mongodb://127.0.0.1:27017/production',
    'mongodb://127.0.0.1:27017/?authSource=admin',
    'mongodb://user:pass@127.0.0.1:27017/',
    'mongodb://127.0.0.1:27017/,mongo.example.com:27017/',
    'not a mongo uri'
  ]) {
    assert.equal(isSafeDisposableMongoUri(unsafe, '1'), false, unsafe);
  }
});

const permitted = isSafeDisposableMongoUri(uri, process.env.GRUK_TEST_MONGO_DISPOSABLE);

test('P0-04: real MongoDB enforces tenant and branch-scoped catalog reads', {
  skip: !permitted && 'Requires GRUK_TEST_MONGO_DISPOSABLE=1 and a loopback-only database-less GRUK_TEST_MONGO_URI'
}, async () => {
  const dbName = 'gruk_p004_isolation_' + crypto.randomBytes(10).toString('hex');
  const conn = mongoose.createConnection(uri, { dbName, serverSelectionTimeoutMS: 5000 });
  try {
    await conn.asPromise();
    // Exercise the production ProductoServicio schema, not a synthetic stand-in.
    // Bind the schema to the disposable connection so production data is untouched.
    const Products = conn.model('ProductoServicio', ProductoServicio.schema);
    const tenantA = new mongoose.Types.ObjectId();
    const tenantB = new mongoose.Types.ObjectId();
    const branchA = new mongoose.Types.ObjectId();
    const branchB = new mongoose.Types.ObjectId();
    const [own, sibling, foreign, global] = await Products.create([
      { empresaId: tenantA, sedeId: branchA, tipo: 'producto', nombre: 'Own', precioVenta: 100, costoUnitario: 10 },
      { empresaId: tenantA, sedeId: branchB, tipo: 'producto', nombre: 'Sibling', precioVenta: 100, costoUnitario: 20 },
      { empresaId: tenantB, sedeId: branchA, tipo: 'producto', nombre: 'Foreign', precioVenta: 100, costoUnitario: 30 },
      { empresaId: tenantA, sedeId: null, tipo: 'producto', nombre: 'Global', precioVenta: 100, costoUnitario: 40 }
    ]);
    const scoped = await Products.find({
      empresaId: tenantA, sedeId: { $in: [branchA, null] }
    }).lean();
    assert.deepEqual(scoped.map(x => String(x._id)).sort(),
      [own, global].map(x => String(x._id)).sort());
    assert.equal(await Products.findOne({
      _id: sibling._id, empresaId: tenantA, sedeId: { $in: [branchA, null] }
    }).lean(), null);
    assert.equal(await Products.findOne({
      _id: foreign._id, empresaId: tenantA, sedeId: { $in: [branchA, null] }
    }).lean(), null);
    // Reverse the tenant/branch perspective: a matching branch ID must never
    // override tenant ownership, and the global catalog is tenant-local.
    const tenantBRead = await Products.find({
      empresaId: tenantB, sedeId: { $in: [branchA, null] }
    }).lean();
    assert.deepEqual(tenantBRead.map(x => String(x._id)), [String(foreign._id)]);
    const branchBRead = await Products.find({
      empresaId: tenantA, sedeId: { $in: [branchB, null] }
    }).lean();
    assert.deepEqual(branchBRead.map(x => String(x._id)).sort(),
      [sibling, global].map(x => String(x._id)).sort());
    assert.equal(await Products.findOne({
      _id: global._id, empresaId: tenantB, sedeId: { $in: [branchA, null] }
    }).lean(), null);
    assert.equal(await Products.findOne({
      _id: own._id, empresaId: tenantA, sedeId: branchB
    }).lean(), null);
    assert.equal(await Products.countDocuments({ empresaId: tenantA, sedeId: null }), 1);
    // Exercise the actual sale-registration service with the production product
    // model bound to this disposable database. Rejected cross-scope products
    // must never reach Venta.create (even if their ObjectIds are known).
    const originalFindOne = ProductoServicio.findOne;
    const originalCreate = Venta.create;
    let attemptedWrites = 0;
    ProductoServicio.findOne = (...args) => Products.findOne(...args);
    Venta.create = async () => {
      attemptedWrites += 1;
      throw new Error('UNEXPECTED_SALE_WRITE');
    };
    try {
      for (const [product, company, branch] of [
        [foreign, tenantA, branchA],
        [sibling, tenantA, branchA],
        [global, tenantB, branchA],
        [own, tenantA, branchB]
      ]) {
        const order = {
          _id: new mongoose.Types.ObjectId(),
          productoServicioId: product._id,
          cantidad: 1,
          precioUnitario: 100,
          precio: 100,
          producto: 'Scope regression'
        };
        await assert.rejects(
          registrarVentaDesdePedido({
            pedido: order, empresaId: company, sedeId: branch, emitirEvento: false
          }),
          /ProductoServicio no pertenece a la empresa/
        );
      }
      assert.equal(attemptedWrites, 0, 'cross-scope orders must not write sales');
      // Positive path: use the actual Venta schema on the disposable connection.
      // Confirm a legitimate order persists once, then a replay returns the
      // same sale without creating a duplicate or leaking across tenants.
      const Sales = conn.model('Venta', Venta.schema);
      await Sales.init(); // Ensure the unique origin/originId index exists.
      Venta.create = (...args) => Sales.create(...args);
      const originalFindSale = Venta.findOne;
      Venta.findOne = (...args) => Sales.findOne(...args);
      try {
        const validOrder = {
          _id: new mongoose.Types.ObjectId(),
          empresaId: tenantA,
          sedeId: branchA,
          productoServicioId: own._id,
          cantidad: 2,
          precioUnitario: 100,
          precio: 200,
          producto: 'Own'
        };
        const first = await registrarVentaDesdePedido({
          pedido: validOrder, empresaId: tenantA, sedeId: branchA, emitirEvento: false
        });
        assert.equal(first.creada, true);
        assert.equal(String(first.venta.empresaId), String(tenantA));
        assert.equal(String(first.venta.sedeId), String(branchA));
        assert.equal(first.venta.costoTotal, 20);
        const replay = await registrarVentaDesdePedido({
          pedido: validOrder, empresaId: tenantA, sedeId: branchA, emitirEvento: false
        });
        assert.equal(replay.creada, false);
        assert.equal(String(replay.venta._id), String(first.venta._id));
        // Same source ID with changed economic data must be a conflict, not
        // an idempotent replay of the original paid sale.
        await assert.rejects(
          registrarVentaDesdePedido({
            pedido: { ...validOrder, precio: 300 },
            empresaId: tenantA, sedeId: branchA, emitirEvento: false
          }),
          (error) => error && error.code === 'GRUK_VENTA_REPLAY_CONFLICT'
        );
        // A replay cannot rewrite payment provenance or swap the product while
        // reusing the same order ID. Both must fail closed and preserve the sale.
        for (const changed of [
          { ...validOrder, metodoPago: 'efectivo' },
          { ...validOrder, productoServicioId: global._id },
          { ...validOrder, cantidad: 3 }
        ]) {
          await assert.rejects(
            registrarVentaDesdePedido({
              pedido: changed, empresaId: tenantA, sedeId: branchA,
              emitirEvento: false
            }),
            (error) => error && error.code === 'GRUK_VENTA_REPLAY_CONFLICT'
          );
        }
        assert.equal(await Sales.countDocuments({ origenId: validOrder._id }), 1);
        // Conflict rejection must also leave the original economic snapshot
        // unchanged in durable storage, not merely preserve the row count.
        const persistedAfterConflicts = await Sales.findById(first.venta._id).lean();
        assert.ok(persistedAfterConflicts, 'original sale remains persisted');
        assert.equal(String(persistedAfterConflicts.empresaId), String(tenantA));
        assert.equal(String(persistedAfterConflicts.sedeId), String(branchA));
        assert.equal(String(persistedAfterConflicts.productoServicioId), String(own._id));
        assert.equal(persistedAfterConflicts.cantidad, 2);
        assert.equal(persistedAfterConflicts.total, first.venta.total);
        assert.equal(persistedAfterConflicts.costoTotal, first.venta.costoTotal);
        // Rejected economic replays must not poison the idempotency key:
        // a subsequent exact replay still resolves to the original paid sale.
        const replayAfterConflicts = await registrarVentaDesdePedido({
          pedido: validOrder, empresaId: tenantA, sedeId: branchA, emitirEvento: false
        });
        assert.equal(replayAfterConflicts.creada, false);
        assert.equal(String(replayAfterConflicts.venta._id), String(first.venta._id));
        assert.equal(await Sales.countDocuments({
          origen: 'restaurante', origenId: validOrder._id
        }), 1);


        // A replay from another tenant or branch must not recover the original
        // sale even when the caller knows its originId and product ObjectId.
        // The original sale must remain unchanged after each rejected attempt.
        for (const [company, branch, product] of [
          [tenantB, branchA, foreign],
          [tenantA, branchB, sibling]
        ]) {
          await assert.rejects(
            registrarVentaDesdePedido({
              pedido: { ...validOrder, productoServicioId: product._id },
              empresaId: company, sedeId: branch, emitirEvento: false
            }),
            (error) => /pedido de otra (empresa|sede)/.test(String(error?.message))
          );
          assert.equal(await Sales.countDocuments({ origenId: validOrder._id }), 1);
          assert.equal(await Sales.countDocuments({ empresaId: company, sedeId: branch }), 0);
          const originalAfterForeignReplay = await Sales.findById(first.venta._id).lean();
          assert.ok(originalAfterForeignReplay, 'foreign replay must preserve original sale');
          assert.equal(String(originalAfterForeignReplay.empresaId), String(tenantA));
          assert.equal(String(originalAfterForeignReplay.sedeId), String(branchA));
          assert.equal(String(originalAfterForeignReplay.productoServicioId), String(own._id));
          assert.equal(originalAfterForeignReplay.cantidad, 2);
          assert.equal(originalAfterForeignReplay.total, first.venta.total);
          assert.equal(originalAfterForeignReplay.costoTotal, first.venta.costoTotal);
        }
        // A cancelled original sale cannot be returned as an idempotent paid
        // replay; restore its state before the concurrency scenario.
        await Sales.updateOne({ _id: first.venta._id }, { $set: { estado: 'anulada' } });
        await assert.rejects(
          registrarVentaDesdePedido({
            pedido: validOrder, empresaId: tenantA, sedeId: branchA, emitirEvento: false
          }),
          (error) => error && error.code === 'GRUK_VENTA_REPLAY_STATE_CONFLICT'
        );
        assert.equal((await Sales.findById(first.venta._id).lean()).estado, 'anulada');
        assert.equal(await Sales.countDocuments({ origen: 'restaurante', origenId: validOrder._id }), 1,
          'cancelled replay must not insert a replacement sale');
        await Sales.updateOne({ _id: first.venta._id }, { $set: { estado: 'pagada' } });
        const restoredReplay = await registrarVentaDesdePedido({
          pedido: validOrder, empresaId: tenantA, sedeId: branchA, emitirEvento: false
        });
        assert.equal(restoredReplay.creada, false);
        assert.equal(String(restoredReplay.venta._id), String(first.venta._id));
        assert.equal(await Sales.countDocuments({ origen: 'restaurante', origenId: validOrder._id }), 1);

        // Race eight first-write attempts for a distinct order through the
        // actual service and MongoDB unique index. Exactly one must create;
        // the others must recover the same persisted sale idempotently.
        const concurrentOrder = {
          ...validOrder,
          _id: new mongoose.Types.ObjectId()
        };
        const concurrentResults = await Promise.all(
          Array.from({ length: 8 }, () => registrarVentaDesdePedido({
            pedido: concurrentOrder, empresaId: tenantA, sedeId: branchA,
            emitirEvento: false
          }))
        );
        assert.equal(concurrentResults.filter(result => result.creada).length, 1);
        assert.equal(concurrentResults.filter(result => !result.creada).length, 7);
        assert.equal(new Set(concurrentResults.map(result =>
          String(result.venta._id))).size, 1);
        assert.equal(await Sales.countDocuments({
          origen: 'restaurante', origenId: concurrentOrder._id
        }), 1);
        assert.equal(await Sales.countDocuments({ empresaId: tenantB }), 0);
        assert.equal(await Sales.countDocuments({ empresaId: tenantA, sedeId: branchB }), 0);
      } finally {
        Venta.findOne = originalFindSale;
      }
    } finally {
      ProductoServicio.findOne = originalFindOne;
      Venta.create = originalCreate;
    }
  } finally {
    if (conn.readyState === 1) await conn.dropDatabase();
    await conn.close();
  }
});
