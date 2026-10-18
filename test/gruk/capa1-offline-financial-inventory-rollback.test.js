"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { stageOfflineFinancialBatch } = require("../../core/offline/offlineFinancialStaging.service");
const { assertFreshOfflineStaging } = require("../../core/offline/offlineInventoryStagingTransaction.service");
const { calculateOfflineStockDeltas } = require("../../core/offline/offlineInventoryDeltas.service");
const { buildOfflineLedgerPlan } = require("../../core/offline/offlineLedgerPlan.service");

const { applyOfflineLegacyInventory } = require("../../core/offline/offlineLegacyInventoryWriter.service");

const uri = process.env.GRUK_TEST_MONGO_URI || process.env.TEST_MONGO_URI;

test("MongoDB real: caída tras 4 diarios y stock revierte toda la transacción", {
  skip: !uri && "Requiere MongoDB de pruebas con replica set",
  timeout: 45000
}, async () => {
  const { mongo } = require("mongoose");
  const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  const name = "gruk_fin_atomic_" + randomUUID().replace(/-/g, "");
  const empresa = new mongo.ObjectId();
  const sede = new mongo.ObjectId();
  const producto = new mongo.ObjectId();
  const empresaId = empresa.toHexString();
  const sedeId = sede.toHexString();
  const productoId = producto.toHexString();
  const context = { empresaId, sedeId, actorId: "operador-uno" };
  const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FA0";
  const plan = { orders: [{
    eventId, localOrderId: "01ARZ3NDEKTSV4RRFFQ69G5FA1",
    totalCop: "7500", items: [{ productoId, cantidad: "2" }]
  }], totalCop: "7500" };
  const deltas = [{ productoId, deltaUnidades: "-2" }];
  let connected = false;
  try {
    await client.connect();
    connected = true;
    const db = client.db(name);
    await db.collection("gruk_offline_ventas").createIndex(
      { empresaId: 1, sedeId: 1, eventId: 1 },
      { unique: true, name: "uniq_offline_sale_tenant_event" });
    await db.collection("gruk_offline_caja_intenciones").createIndex(
      { empresaId: 1, sedeId: 1, eventId: 1 },
      { unique: true, name: "uniq_offline_cash_tenant_event" });
    await db.collection("gruk_offline_stock_movimientos").createIndex(
      { empresaId: 1, sedeId: 1, batchId: 1, productoId: 1 },
      { unique: true, name: "uniq_offline_stock_tenant_batch_product" });
    await db.collection("gruk_ledger_movimientos").createIndex(
      { empresaId: 1, sedeId: 1, eventId: 1, tipo: 1 },
      { unique: true, name: "uniq_offline_ledger_event_type_tenant" });
    await db.collection("inventarios").insertOne({
      empresaId: empresa, sedeId: sede, productoServicioId: producto,
      anulado: false, cantidad: 5
    });
    const inventoryQuery = { empresaId: empresa, sedeId: sede, productoServicioId: producto, anulado: false };
    const totals = async () => ({
      sales: await db.collection("gruk_offline_ventas").countDocuments({ empresaId, sedeId }),
      cash: await db.collection("gruk_offline_caja_intenciones").countDocuments({ empresaId, sedeId }),
      stockJournal: await db.collection("gruk_offline_stock_movimientos").countDocuments({ empresaId, sedeId }),
      ledger: await db.collection("gruk_ledger_movimientos").countDocuments({ empresaId, sedeId }),
      inventory: (await db.collection("inventarios").findOne(inventoryQuery)).cantidad
    });
    const stage = async session => {
      const staged = await stageOfflineFinancialBatch({
        db, session, context, plan, inventoryDeltas: calculateOfflineStockDeltas(plan),
        ledgerMovements: buildOfflineLedgerPlan(plan)
      });
      assertFreshOfflineStaging(staged, deltas, plan);
      const inventory = await applyOfflineLegacyInventory({
        db, session, context, inventoryDeltas: deltas,
        objectId: id => new mongo.ObjectId(id)
      });
      assert.equal(staged.sales.totalCop, "7500");
      assert.equal(staged.cash.totalCop, "7500");
      assert.equal(staged.ledger.totalCop, "7500");
      assert.equal(staged.stock.records.length, 1);
      assert.deepEqual(inventory.map(x => [x.antes, x.despues]), [["5", "3"]]);
    };
    const transactionOptions = { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } };
    const failing = client.startSession();
    try {
      await assert.rejects(
        failing.withTransaction(async () => {
          await stage(failing);
          throw new Error("INJECTED_FAILURE_AFTER_ALL_WRITES");
        }, transactionOptions),
        /INJECTED_FAILURE_AFTER_ALL_WRITES/
      );
    } finally { await failing.endSession(); }
    assert.deepEqual(await totals(), { sales: 0, cash: 0, stockJournal: 0, ledger: 0, inventory: 5 },
      "La falla debe revertir ventas, caja e inventario");

    const committed = client.startSession();
    try {
      await committed.withTransaction(() => stage(committed), transactionOptions);
    } finally { await committed.endSession(); }
    assert.deepEqual(await totals(), { sales: 1, cash: 1, stockJournal: 1, ledger: 1, inventory: 3 });
    const cashDoc = await db.collection("gruk_offline_caja_intenciones").findOne({ empresaId, sedeId, eventId });
    assert.equal(cashDoc.cobrado, false, "La intención de caja nunca es un cobro confirmado");
    assert.equal(cashDoc.status, "PENDIENTE_CONCILIACION");
    const ledgerDoc = await db.collection("gruk_ledger_movimientos").findOne({ empresaId, sedeId, eventId });
    assert.equal(ledgerDoc.montoCop, "7500");
    assert.equal(ledgerDoc.deletedAt, null);

    // The real staging writers return inserted:false on identical retries.
    // Production guards must abort BEFORE inventory is discounted a second time.
    const replay = client.startSession();
    try {
      await assert.rejects(
        replay.withTransaction(async () => {
          const repeated = await stageOfflineFinancialBatch({
            db, session: replay, context, plan,
            inventoryDeltas: calculateOfflineStockDeltas(plan),
            ledgerMovements: buildOfflineLedgerPlan(plan)
          });
          assert.equal(repeated.sales.records[0].inserted, false);
          assert.equal(repeated.cash.records[0].inserted, false);
          assert.equal(repeated.stock.records[0].inserted, false);
          assert.equal(repeated.ledger.entries[0].inserted, false);
          assertFreshOfflineStaging(repeated, deltas, plan);
          throw Error("REPLAY_MUST_NOT_REACH_INVENTORY");
        }, transactionOptions),
        error => error?.code === "OFFLINE_INVENTORY_REPLAY_REQUIRES_RECONCILIATION"
      );
    } finally { await replay.endSession(); }
    assert.deepEqual(await totals(),
      { sales: 1, cash: 1, stockJournal: 1, ledger: 1, inventory: 3 },
      "El reintento no duplica registros ni descuenta otra vez inventario");
  } finally {
    if (connected) {
      try { await client.db(name).dropDatabase(); } finally { await client.close(); }
    } else await client.close();
  }
});
