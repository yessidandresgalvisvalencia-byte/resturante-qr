"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("async consumer rejection prevents outbox acknowledgement and allows retry", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const eventBus = require("../../core/eventos/eventBus");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_async_ack" });
  const empresaId = new mongoose.Types.ObjectId();
  const aggregateId = new mongoose.Types.ObjectId();
  const eventoId = new mongoose.Types.ObjectId();
  let intentos = 0;
  const consumidor = async envelope => {
    assert.equal(envelope.metadata.eventId, String(eventoId));
    intentos += 1;
    await Promise.resolve();
    if (intentos === 1) throw new Error("CONSUMIDOR_ASINCRONO_FALLIDO");
  };
  eventBus.on("VENTA_COMPLETADA", consumidor);
  try {
    await OutboxEvent.init();
    await OutboxEvent.create({
      _id: eventoId, empresaId, aggregateId,
      eventName: "VENTA_COMPLETADA", payload: { empresaId, ventaId: aggregateId }
    });
    await assert.rejects(despacharSiguienteVenta(), /CONSUMIDOR_ASINCRONO_FALLIDO/);
    assert.equal((await OutboxEvent.findById(eventoId)).estado, "PENDIENTE");
    const reintento = await despacharSiguienteVenta();
    assert.equal(reintento.entregado, true);
    assert.equal(intentos, 2);
    assert.equal((await OutboxEvent.findById(eventoId)).estado, "ENTREGADO");
  } finally {
    eventBus.off("VENTA_COMPLETADA", consumidor);
    await mongoose.disconnect();
  }
});
