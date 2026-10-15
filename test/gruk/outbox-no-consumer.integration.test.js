"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("outbox without registered consumer stays pending for retry", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const eventBus = require("../../core/eventos/eventBus");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_missing_listener" });
  try {
    await OutboxEvent.init();
    assert.equal(eventBus.listenerCount("VENTA_COMPLETADA"), 0);
    const empresaId = new mongoose.Types.ObjectId();
    const aggregateId = new mongoose.Types.ObjectId();
    const evento = await OutboxEvent.create({
      empresaId, aggregateId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId: aggregateId }
    });
    await assert.rejects(despacharSiguienteVenta(), /OUTBOX_SIN_CONSUMIDORES_REGISTRADOS/);
    const almacenado = await OutboxEvent.findById(evento._id).lean();
    assert.equal(almacenado.estado, "PENDIENTE");
    assert.equal(almacenado.intentos, 1);
    assert.match(almacenado.ultimoError, /OUTBOX_SIN_CONSUMIDORES_REGISTRADOS/);
  } finally {
    await mongoose.disconnect();
  }
});
