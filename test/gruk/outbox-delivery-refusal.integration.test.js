"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("explicit delivery refusal cannot acknowledge an outbox event", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_delivery_refused" });
  try {
    await OutboxEvent.init();
    const empresaId = new mongoose.Types.ObjectId();
    const aggregateId = new mongoose.Types.ObjectId();
    const evento = await OutboxEvent.create({
      empresaId, aggregateId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId: aggregateId }
    });
    await assert.rejects(
      despacharSiguienteVenta({ emitir: async () => false }),
      /OUTBOX_ENTREGA_NO_CONFIRMADA/
    );
    let almacenado = await OutboxEvent.findById(evento._id).lean();
    assert.equal(almacenado.estado, "PENDIENTE");
    assert.equal(almacenado.intentos, 1);
    assert.match(almacenado.ultimoError, /OUTBOX_ENTREGA_NO_CONFIRMADA/);
    assert.equal((await despacharSiguienteVenta({ emitir: async () => true })).entregado, true);
    almacenado = await OutboxEvent.findById(evento._id).lean();
    assert.equal(almacenado.estado, "ENTREGADO");
    assert.equal(almacenado.intentos, 2);
  } finally {
    await mongoose.disconnect();
  }
});
