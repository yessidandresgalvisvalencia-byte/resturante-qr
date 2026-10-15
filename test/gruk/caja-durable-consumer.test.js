"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("Caja durable adapter exports a callable consumer without starting a worker", () => {
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  assert.equal(typeof consumirVentaEnCaja, "function");
});

test("Caja durable adapter rejects malformed outbox identities before writing", async () => {
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  await assert.rejects(
    consumirVentaEnCaja({ eventId: "invalid", empresaId: "invalid" }),
    /CONSUMIDOR_IDENTIDAD_INVALIDA/
  );
});

test("Caja durable consumer commits one movement and one receipt on retry", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Receipt = require("../../models/GrukEventoProcesado");
  const Movimiento = require("../../core/finanzas/models/MovimientoCaja");
  const { consumirVentaEnCaja } = require("../../core/eventos/cajaVenta.consumer");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_caja_durable_test" });
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  try {
    await Promise.all([Outbox.init(), Receipt.init(), Movimiento.init()]);
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId, total: 12000, metodoPago: "",
        fecha: new Date(), sourceUpdatedAt: new Date() }
    });
    const first = await consumirVentaEnCaja({ eventId: event._id, empresaId });
    const second = await consumirVentaEnCaja({ eventId: event._id, empresaId });
    assert.equal(first.aplicado, true);
    assert.equal(second.duplicado, true);
    assert.equal(await Movimiento.countDocuments({ empresaId, origenId: ventaId }), 1);
    assert.equal(await Receipt.countDocuments({ empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" }), 1);
  } finally {
    await mongoose.disconnect();
  }
});
