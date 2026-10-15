"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("sale outbox closure requires both durable consumer ACKs", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { cerrarVentaEntregada } = require("../../core/eventos/cerrarVentaEntregada.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_outbox_close_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    assert.deepEqual(await cerrarVentaEntregada({ empresaId, eventId: event._id }),
      { cerrado: false, motivo: "CONSUMIDORES_PENDIENTES" });
    await Entrega.create([
      { empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1", estado: "ENTREGADO" },
      { empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1", estado: "PENDIENTE" }
    ], { ordered: true });
    assert.equal((await cerrarVentaEntregada({ empresaId, eventId: event._id })).cerrado, false);
    assert.equal((await Outbox.findById(event._id)).estado, "PENDIENTE");
    await Entrega.updateOne({ eventId: event._id, consumidor: "FACTURACION_VENTA_V1" },
      { $set: { estado: "ENTREGADO" } });
    assert.deepEqual(await cerrarVentaEntregada({ empresaId, eventId: event._id }), { cerrado: true });
    assert.equal((await Outbox.findById(event._id)).estado, "ENTREGADO");
    assert.deepEqual(await cerrarVentaEntregada({ empresaId, eventId: event._id }),
      { cerrado: false, yaEntregado: true });
  } finally {
    await mongoose.disconnect();
  }
});
