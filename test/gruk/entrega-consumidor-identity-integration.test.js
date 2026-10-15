"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("claim refuses outbox with mismatched tenant payload before acquiring lease", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { reclamarEntrega } = require("../../core/eventos/entregaConsumidor.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_claim_identity_test" });
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId: new mongoose.Types.ObjectId(), ventaId, total: 1000 }
    });
    await Entrega.create({ empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" });
    await assert.rejects(reclamarEntrega({
      empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1"
    }), /ENTREGA_EVENTO_IDENTIDAD_INCONSISTENTE/);
    const saved = await Entrega.findOne({ empresaId, eventId: event._id }).lean();
    assert.equal(saved.estado, "PENDIENTE");
    assert.equal(saved.intentos, 0);
  } finally {
    await mongoose.disconnect();
  }
});
