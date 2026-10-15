"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("outbox close fails closed for missing mandatory consumer even if other consumers ACK", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { cerrarVentaEntregada } = require("../../core/eventos/cerrarVentaEntregada.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_outbox_missing_required_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    await Entrega.create([
      { empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1", estado: "ENTREGADO" },
      { empresaId, eventId: event._id, consumidor: "AUDITORIA_VENTA_V1", estado: "ENTREGADO" }
    ], { ordered: true });
    assert.deepEqual(await cerrarVentaEntregada({ empresaId, eventId: event._id }),
      { cerrado: false, motivo: "CONSUMIDORES_PENDIENTES" });
    assert.equal((await Outbox.findById(event._id)).estado, "PENDIENTE");
  } finally {
    await mongoose.disconnect();
  }
});
