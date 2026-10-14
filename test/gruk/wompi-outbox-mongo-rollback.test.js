"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");

test("Outbox y venta se revierten juntos si falla insertar el evento", async (t) => {
  const uri = process.env.TEST_MONGO_URI;
  if (!uri) { t.skip("TEST_MONGO_URI requerido para prueba ACID real"); return; }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db("gruk_test_outbox_rollback");
  const ventas = db.collection("ventas_rollback");
  const outbox = db.collection("outbox_rollback");
  const id = new mongoose.Types.ObjectId().toHexString();
  const session = client.startSession();
  try {
    await assert.rejects(async () => {
      await session.withTransaction(async () => {
        await ventas.insertOne({ _id: id, total: 52000 }, { session });
        await outbox.insertOne({ _id: id, eventId: "VENTA_COMPLETADA:" + id }, { session });
        throw new Error("FALLO_SIMULADO_ANTES_COMMIT");
      });
    }, /FALLO_SIMULADO_ANTES_COMMIT/);
    assert.equal(await ventas.countDocuments({ _id: id }), 0);
    assert.equal(await outbox.countDocuments({ _id: id }), 0);
  } finally {
    await session.endSession();
    await db.dropDatabase();
    await client.close();
  }
});
