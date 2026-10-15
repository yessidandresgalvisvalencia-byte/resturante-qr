"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("outbox refuses one-shot listeners without consuming them", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const eventBus = require("../../core/eventos/eventBus");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_once_listener" });
  const empresaId = new mongoose.Types.ObjectId();
  const aggregateId = new mongoose.Types.ObjectId();
  let ejecuciones = 0;
  const listener = () => { ejecuciones += 1; };
  eventBus.once("VENTA_COMPLETADA", listener);
  try {
    await OutboxEvent.init();
    const evento = await OutboxEvent.create({
      empresaId, aggregateId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId: aggregateId }
    });
    await assert.rejects(despacharSiguienteVenta(), /OUTBOX_CONSUMIDOR_ONCE_NO_PERMITIDO/);
    assert.equal(ejecuciones, 0);
    assert.equal(eventBus.listenerCount("VENTA_COMPLETADA"), 1);
    assert.equal((await OutboxEvent.findById(evento._id)).estado, "PENDIENTE");
  } finally {
    eventBus.removeListener("VENTA_COMPLETADA", listener);
    await mongoose.disconnect();
  }
});
