"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("invalid dispatcher inputs fail before claiming pending outbox events", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_invalid_input" });
  try {
    await OutboxEvent.init();
    const empresaId = new mongoose.Types.ObjectId();
    const aggregateId = new mongoose.Types.ObjectId();
    const evento = await OutboxEvent.create({
      empresaId, aggregateId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId: aggregateId }
    });
    await assert.rejects(despacharSiguienteVenta({ now: new Date("invalid") }), /OUTBOX_FECHA_INVALIDA/);
    await assert.rejects(despacharSiguienteVenta({ now: "2026-10-15" }), /OUTBOX_FECHA_INVALIDA/);
    await assert.rejects(despacharSiguienteVenta({ emitir: null }), /OUTBOX_EMISOR_INVALIDO/);
    await assert.rejects(
      despacharSiguienteVenta({ now: new Date(8640000000000000), emitir: async () => true }),
      /OUTBOX_LEASE_FECHA_FUERA_DE_RANGO/
    );
    const almacenado = await OutboxEvent.findById(evento._id).lean();
    assert.equal(almacenado.estado, "PENDIENTE");
    assert.equal(almacenado.intentos, 0);
    assert.equal(almacenado.leaseToken, null);
  } finally {
    await mongoose.disconnect();
  }
});
