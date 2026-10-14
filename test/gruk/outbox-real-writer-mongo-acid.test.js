"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Outbox = require("../../models/GrukOutbox");
const { registrarEventoEnTransaccion } = require("../../services/p0/outbox.service");

test("Outbox real: venta y evento hacen commit o rollback en la misma sesión", async (t) => {
  if (!process.env.TEST_MONGO_URI) { t.skip("MongoDB replica set no configurado"); return; }
  await mongoose.connect(process.env.TEST_MONGO_URI, {
    dbName: "gruk_test_outbox_real_writer", serverSelectionTimeoutMS: 5000
  });
  const Venta = mongoose.connection.collection("ventas_test_outbox");
  const empresaId = new mongoose.Types.ObjectId();
  const firstVentaId = new mongoose.Types.ObjectId();
  const failedVentaId = new mongoose.Types.ObjectId();
  const crearEvento = (id) => ({
    eventId: "VENTA_COMPLETADA:" + id.toString(),
    empresaId, aggregateId: id, eventName: "VENTA_COMPLETADA",
    payload: { ventaId: id.toString(), restaurantId: "test-restaurant", total: 52000 }
  });
  const session = await mongoose.startSession();
  try {
    await Outbox.init();
    await session.withTransaction(async () => {
      await Venta.insertOne({ _id: firstVentaId, empresaId, total: 52000 }, { session });
      await registrarEventoEnTransaccion(crearEvento(firstVentaId), session);
    });
    assert.equal(await Venta.countDocuments({ _id: firstVentaId }), 1);
    assert.equal(await Outbox.countDocuments({ eventId: "VENTA_COMPLETADA:" + firstVentaId }), 1);

    await assert.rejects(session.withTransaction(async () => {
      await Venta.insertOne({ _id: failedVentaId, empresaId, total: 52000 }, { session });
      await registrarEventoEnTransaccion(crearEvento(failedVentaId), session);
      throw new Error("FALLO_PRECOMMIT_REAL");
    }), /FALLO_PRECOMMIT_REAL/);
    assert.equal(await Venta.countDocuments({ _id: failedVentaId }), 0);
    assert.equal(await Outbox.countDocuments({ eventId: "VENTA_COMPLETADA:" + failedVentaId }), 0);

    await assert.rejects(session.withTransaction(async () => {
      await registrarEventoEnTransaccion(crearEvento(firstVentaId), session);
    }), (error) => error.code === 11000);
    assert.equal(await Outbox.countDocuments({ eventId: "VENTA_COMPLETADA:" + firstVentaId }), 1);
  } finally {
    await session.endSession();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
