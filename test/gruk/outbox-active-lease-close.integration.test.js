"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("outbox closure refuses an event with active processing state", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { cerrarVentaEntregada } = require("../../core/eventos/cerrarVentaEntregada.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_outbox_active_lease_close_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      estado: "PROCESANDO", leaseToken: "active-lease",
      leaseHasta: new Date(Date.now() + 60000),
      payload: { empresaId, ventaId }
    });
    await Entrega.create([
      { empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1", estado: "ENTREGADO" },
      { empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1", estado: "ENTREGADO" }
    ], { ordered: true });
    assert.deepEqual(await cerrarVentaEntregada({ empresaId, eventId: event._id }),
      { cerrado: false, motivo: "EVENTO_NO_PENDIENTE" });
    const after = await Outbox.findById(event._id).lean();
    assert.equal(after.estado, "PROCESANDO");
    assert.equal(after.leaseToken, "active-lease");
  } finally {
    await mongoose.disconnect();
  }
});
