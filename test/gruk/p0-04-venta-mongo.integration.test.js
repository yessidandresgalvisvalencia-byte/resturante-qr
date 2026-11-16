'use strict';

// Opt-in integration test against a disposable, dedicated MongoDB database.
// Run: GRUK_P004_TEST_MONGO_URI='mongodb://127.0.0.1:27017' GRUK_P004_TEST_DB='gruk_p004_isolated_test' node --test test/gruk/p0-04-venta-mongo.integration.test.js
// Never point this test at a production database or a shared environment.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Venta = require('../../models/Venta');

const uri = process.env.GRUK_P004_TEST_MONGO_URI;
const database = process.env.GRUK_P004_TEST_DB;
const permitted = Boolean(uri && database && /^gruk_p004_[a-z0-9_]*test$/i.test(database) &&
  !/(personal|blushea|production|prod)/i.test(database));

// A configured integration job must fail closed instead of reporting a green skipped test.
// Only an entirely unconfigured local/unit run may skip the database-dependent assertion.
test('P0-04 MongoDB integration configuration is explicit and safe', { skip: !uri && !database }, () => {
  assert.ok(uri, 'GRUK_P004_TEST_MONGO_URI is required when integration is configured');
  assert.ok(database, 'GRUK_P004_TEST_DB is required when integration is configured');
  assert.ok(permitted, 'GRUK_P004_TEST_DB must be a dedicated gruk_p004_*test database, never personal, Blushea or production');
  assert.ok(uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'), 'Integration URI must use MongoDB protocol');
});

test('P0-04 MongoDB: origin uniqueness is tenant scoped and duplicate retries are rejected', { skip: !uri && !database && 'Requires explicitly configured isolated test MongoDB' }, async () => {
  // Guard before any network connection or database operation. A partially configured
  // run must fail without contacting an unintended MongoDB instance.
  assert.ok(permitted, 'Dedicated GRUK P0-04 test URI and database are required before connecting');
  assert.ok(uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'), 'MongoDB protocol required');
  const connection = await mongoose.createConnection(uri, { dbName: database, serverSelectionTimeoutMS: 5000 }).asPromise();
  // A unique collection name avoids touching unrelated fixtures, even within the dedicated test DB.
  const collectionName = 'p004_tenant_origin_' + process.pid + '_' + Date.now();
  const sales = connection.db.collection(collectionName);
  try {
    // Exercise the index declared by the production Venta schema, not a duplicated fixture.
    const declared = Venta.schema.indexes().find(([keys]) =>
      keys.empresaId === 1 && keys.origen === 1 && keys.origenId === 1
    );
    assert.ok(declared, 'Venta model must declare the tenant-scoped origin index');
    const [keys, options] = declared;
    await sales.createIndex(keys, options);
    // Assert the actual index installed by MongoDB, not only the requested DDL.
    const installed = await sales.indexes();
    const originIndex = installed.find(index =>
      index.key?.empresaId === 1 && index.key?.origen === 1 && index.key?.origenId === 1
    );
    assert.ok(originIndex, 'Tenant-scoped origin index must exist');
    assert.equal(originIndex.unique, true);
    assert.deepEqual(originIndex.partialFilterExpression, { origenId: { $type: 'objectId' } });

    const tenantA = new mongoose.Types.ObjectId();
    const tenantB = new mongoose.Types.ObjectId();
    const originId = new mongoose.Types.ObjectId();
    const sale = (empresaId, sedeId) => ({ empresaId, sedeId, origen: 'pedido', origenId });
    await sales.insertOne(sale(tenantA, new mongoose.Types.ObjectId()));
    // Same external origin is valid in a different company.
    await sales.insertOne(sale(tenantB, new mongoose.Types.ObjectId()));
    // Same origin in another site of the SAME company must still be rejected.
    await assert.rejects(
      sales.insertOne(sale(tenantA, new mongoose.Types.ObjectId())),
      error => error.code === 11000
    );
    assert.equal(await sales.countDocuments({ origenId }), 2);
    // The same external ID under a different origin type is a distinct business key.
    await sales.insertOne({ empresaId: tenantA, sedeId: new mongoose.Types.ObjectId(), origen: 'devolucion', origenId });
    assert.equal(await sales.countDocuments({ empresaId: tenantA, origenId }), 2);
    // Concurrent retries for a fresh origin must create exactly one sale per tenant.
    const concurrentOrigin = new mongoose.Types.ObjectId();
    const attempts = await Promise.allSettled(Array.from({ length: 8 }, () =>
      sales.insertOne({
        empresaId: tenantA,
        sedeId: new mongoose.Types.ObjectId(),
        origen: 'pedido',
        origenId: concurrentOrigin
      })
    ));
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(result => result.status === 'rejected' && result.reason.code === 11000).length, 7);
    assert.equal(await sales.countDocuments({ empresaId: tenantA, origenId: concurrentOrigin }), 1);
    // A retry key already used by tenant A must not block tenant B.
    await sales.insertOne({
      empresaId: tenantB,
      sedeId: new mongoose.Types.ObjectId(),
      origen: 'pedido',
      origenId: concurrentOrigin
    });
    assert.equal(await sales.countDocuments({ origen: 'pedido', origenId: concurrentOrigin }), 2);
    // Independent concurrent retry storms across tenants must each settle on one sale.
    const sharedOrigin = new mongoose.Types.ObjectId();
    const crossTenantAttempts = await Promise.allSettled(
      [tenantA, tenantB].flatMap(empresaId =>
        Array.from({ length: 6 }, () => sales.insertOne({
          empresaId,
          sedeId: new mongoose.Types.ObjectId(),
          origen: 'pedido',
          origenId: sharedOrigin
        }))
      )
    );
    assert.equal(crossTenantAttempts.filter(result => result.status === 'fulfilled').length, 2);
    assert.equal(crossTenantAttempts.filter(result =>
      result.status === 'rejected' && result.reason.code === 11000
    ).length, 10);
    assert.equal(await sales.countDocuments({ empresaId: tenantA, origenId: sharedOrigin }), 1);
    assert.equal(await sales.countDocuments({ empresaId: tenantB, origenId: sharedOrigin }), 1);
    // Originless records must remain permitted under the partial index.
    await sales.insertMany([{ empresaId: tenantA, origen: 'manual' }, { empresaId: tenantA, origen: 'manual' }]);
    // Non-ObjectId origin identifiers do not participate in the partial unique index.
    await sales.insertMany([
      { empresaId: tenantA, origen: 'manual', origenId: null },
      { empresaId: tenantA, origen: 'manual', origenId: null },
      { empresaId: tenantA, origen: 'manual', origenId: 'legacy-string' },
      { empresaId: tenantA, origen: 'manual', origenId: 'legacy-string' }
    ]);
    assert.equal(await sales.countDocuments({ empresaId: tenantA }), 10);
    assert.equal(await sales.countDocuments({ empresaId: tenantB }), 3);
  } finally {
    try { await sales.drop(); } catch (error) { if (error.codeName !== 'NamespaceNotFound') throw error; }
    await connection.close();
  }
});
