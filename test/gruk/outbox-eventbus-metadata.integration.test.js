"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("default outbox dispatcher delivers stable event identity through eventBus", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const eventBus = require("../../core/eventos/eventBus");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_event_metadata" });
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  let evento;
  const recibidos = [];
  const listener = e => recibidos.push(e);
  eventBus.on("VENTA_COMPLETADA", listener);
  try {
    await OutboxEvent.init();
    evento = await OutboxEvent.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    const result = await despacharSiguienteVenta();
    assert.equal(result.entregado, true);
    assert.equal(recibidos.length, 1);
    assert.equal(recibidos[0].metadata.eventId, String(evento._id));
    assert.equal(recibidos[0].metadata.empresaId, String(empresaId));
    assert.equal(recibidos[0].metadata.aggregateId, String(ventaId));
    assert.equal(recibidos[0].payload.ventaId.toString(), String(ventaId));
    assert.equal((await OutboxEvent.findById(evento._id)).estado, "ENTREGADO");
  } finally {
    eventBus.off("VENTA_COMPLETADA", listener);
    await mongoose.disconnect();
  }
});
