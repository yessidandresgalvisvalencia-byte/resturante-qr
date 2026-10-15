"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("Caja consumer obligation commits movement, receipt and independent ACK", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const Receipt = require("../../models/GrukEventoProcesado");
  const Movimiento = require("../../core/finanzas/models/MovimientoCaja");
  const { procesarEntregaCaja } = require("../../core/eventos/procesarEntregaCaja.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_caja_independent_delivery_test" });
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  try {
    await Promise.all([Outbox.init(), Entrega.init(), Receipt.init(), Movimiento.init()]);
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId, total: 12000, metodoPago: "",
        fecha: new Date(), sourceUpdatedAt: new Date() }
    });
    await Entrega.create([
      { empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" },
      { empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1" }
    ], { ordered: true });
    const result = await procesarEntregaCaja({ eventId: event._id, empresaId });
    assert.equal(result.procesado, true);
    assert.equal(await Movimiento.countDocuments({ empresaId, origenId: ventaId }), 1);
    assert.equal(await Receipt.countDocuments({ empresaId, eventId: event._id }), 1);
    assert.equal((await Entrega.findOne({
      empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1"
    })).estado, "ENTREGADO");
    assert.equal((await Entrega.findOne({
      empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1"
    })).estado, "PENDIENTE");
    assert.equal((await Outbox.findById(event._id)).estado, "PENDIENTE");
    const again = await procesarEntregaCaja({ eventId: event._id, empresaId });
    assert.equal(again.procesado, false);
    assert.equal(await Movimiento.countDocuments({ empresaId, origenId: ventaId }), 1);
  } finally {
    await mongoose.disconnect();
  }
});
