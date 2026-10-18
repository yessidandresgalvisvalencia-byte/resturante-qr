"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { stageOfflineSales } = require("../../core/offline/offlineSalesStaging.service");
const { stageOfflineCashIntents } = require("../../core/offline/offlineCashStaging.service");
const { applyOfflineLegacyInventory } = require("../../core/offline/offlineLegacyInventoryWriter.service");

const uri = process.env.GRUK_TEST_MONGO_URI || process.env.TEST_MONGO_URI;

test("MongoDB real: caída tras venta, caja y stock revierte toda la transacción", {
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
    totalCop: "7500", items: [{ productoId, cantidad: 2 }]
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
    await db.collection("inventarios").insertOne({
      empresaId: empresa, sedeId: sede, productoServicioId: producto,
      anulado: false, cantidad: 5
    });
    const inventoryQuery = { empresaId: empresa, sedeId: sede, productoServicioId: producto, anulado: false };
    const totals = async () => ({
      sales: await db.collection("gruk_offline_ventas").countDocuments({ empresaId, sedeId }),
      cash: await db.collection("gruk_offline_caja_intenciones").countDocuments({ empresaId, sedeId }),
      inventory: (await db.collection("inventarios").findOne(inventoryQuery)).cantidad
    });
    const stage = async session => {
      const sales = await stageOfflineSales({ db, session, context, plan });
      const cash = await stageOfflineCashIntents({ db, session, context, plan });
      const inventory = await applyOfflineLegacyInventory({
        db, session, context, inventoryDeltas: deltas,
        objectId: id => new mongo.ObjectId(id)
      });
      assert.equal(sales.totalCop, "7500");
      assert.equal(cash.totalCop, "7500");
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
    assert.deepEqual(await totals(), { sales: 0, cash: 0, inventory: 5 },
      "La falla debe revertir ventas, caja e inventario");

    const committed = client.startSession();
    try {
      await committed.withTransaction(() => stage(committed), transactionOptions);
    } finally { await committed.endSession(); }
    assert.deepEqual(await totals(), { sales: 1, cash: 1, inventory: 3 });
    const cashDoc = await db.collection("gruk_offline_caja_intenciones").findOne({ empresaId, sedeId, eventId });
    assert.equal(cashDoc.cobrado, false, "La intención de caja nunca es un cobro confirmado");
    assert.equal(cashDoc.status, "PENDIENTE_CONCILIACION");
  } finally {
    if (connected) {
      try { await client.db(name).dropDatabase(); } finally { await client.close(); }
    } else await client.close();
  }
});
