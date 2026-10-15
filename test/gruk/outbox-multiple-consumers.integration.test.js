"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("outbox retries when one of multiple async consumers fails", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const eventBus = require("../../core/eventos/eventBus");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_multiple_consumers" });
  const empresaId = new mongoose.Types.ObjectId();
  const aggregateId = new mongoose.Types.ObjectId();
  const recibidos = [];
  let intentosSegundo = 0;
  const primero = async evento => {
    await Promise.resolve();
    recibidos.push(evento.metadata.eventId);
  };
  const segundo = async evento => {
    assert.equal(evento.metadata.empresaId, String(empresaId));
    intentosSegundo += 1;
    await Promise.resolve();
    if (intentosSegundo === 1) throw new Error("SEGUNDO_CONSUMIDOR_FALLIDO");
  };
  eventBus.on("VENTA_COMPLETADA", primero);
  eventBus.on("VENTA_COMPLETADA", segundo);
  try {
    await OutboxEvent.init();
    const evento = await OutboxEvent.create({
      empresaId, aggregateId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId: aggregateId }
    });
    await assert.rejects(despacharSiguienteVenta(), /SEGUNDO_CONSUMIDOR_FALLIDO/);
    assert.equal((await OutboxEvent.findById(evento._id)).estado, "PENDIENTE");
    assert.deepEqual(recibidos, [String(evento._id)]);
    const segundoIntento = await despacharSiguienteVenta();
    assert.equal(segundoIntento.entregado, true);
    assert.equal(intentosSegundo, 2);
    assert.deepEqual(recibidos, [String(evento._id), String(evento._id)]);
    assert.equal((await OutboxEvent.findById(evento._id)).estado, "ENTREGADO");
  } finally {
    eventBus.off("VENTA_COMPLETADA", primero);
    eventBus.off("VENTA_COMPLETADA", segundo);
    await mongoose.disconnect();
  }
});
