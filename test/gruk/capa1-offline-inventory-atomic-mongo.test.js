"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { applyOfflineLegacyInventory } = require("../../core/offline/offlineLegacyInventoryWriter.service");

const uri = process.env.GRUK_TEST_MONGO_URI || process.env.TEST_MONGO_URI;

test("MongoDB real: stock offline revierte TODO si el segundo producto no alcanza", {
  skip: !uri && "Requiere MongoDB replica set de pruebas",
  timeout: 45000
}, async () => {
  const { mongo } = require("mongoose");
  const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  const name = "gruk_inv_atomic_" + randomUUID().replace(/-/g, "");
  const empresaId = new mongo.ObjectId(), sedeId = new mongo.ObjectId();
  const productA = new mongo.ObjectId(), productB = new mongo.ObjectId();
  const otherEmpresa = new mongo.ObjectId();
  const ctx = { empresaId: empresaId.toHexString(), sedeId: sedeId.toHexString(), actorId: "operador-a" };
  let connected = false;
  try {
    await client.connect();
    connected = true;
    const db = client.db(name);
    const inventories = db.collection("inventarios");
    await inventories.insertMany([
      { empresaId, sedeId, productoServicioId: productA, cantidad: 8, anulado: false },
      { empresaId, sedeId, productoServicioId: productB, cantidad: 1, anulado: false },
      { empresaId: otherEmpresa, sedeId, productoServicioId: productA, cantidad: 30, anulado: false }
    ]);
    const identity = id => ({ empresaId, sedeId, productoServicioId: id, anulado: false });
    const balances = async () => [
      (await inventories.findOne(identity(productA))).cantidad,
      (await inventories.findOne(identity(productB))).cantidad,
      (await inventories.findOne({ empresaId: otherEmpresa, sedeId, productoServicioId: productA })).cantidad
    ];

    const bad = [
      { productoId: productA.toHexString(), deltaUnidades: "-3" },
      { productoId: productB.toHexString(), deltaUnidades: "-2" }
    ];
    const first = client.startSession();
    try {
      await assert.rejects(
        first.withTransaction(() => applyOfflineLegacyInventory({
          db, session: first, context: ctx, inventoryDeltas: bad,
          objectId: id => new mongo.ObjectId(id)
        }), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } }),
        error => error?.code === "OFFLINE_INVENTORY_INSUFFICIENT"
      );
    } finally { await first.endSession(); }
    assert.deepEqual(await balances(), [8, 1, 30], "No debe persistir el descuento del primer producto");

    const good = [
      { productoId: productA.toHexString(), deltaUnidades: "-3" },
      { productoId: productB.toHexString(), deltaUnidades: "-1" }
    ];
    const second = client.startSession();
    try {
      const applied = await second.withTransaction(() => applyOfflineLegacyInventory({
        db, session: second, context: ctx, inventoryDeltas: good,
        objectId: id => new mongo.ObjectId(id)
      }), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      assert.deepEqual(applied.map(r => [r.antes, r.despues]), [["8", "5"], ["1", "0"]]);
    } finally { await second.endSession(); }
    assert.deepEqual(await balances(), [5, 0, 30], "Solo descuentan los productos de la empresa autorizada");
  } finally {
    if (connected) {
      try { await client.db(name).dropDatabase(); } finally { await client.close(); }
    } else await client.close();
  }
});
