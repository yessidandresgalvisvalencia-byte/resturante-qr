"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("individual async listener returning false prevents durable acknowledgement", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const eventBus = require("../../core/eventos/eventBus");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_listener_negative_ack" });
  const empresaId = new mongoose.Types.ObjectId();
  const aggregateId = new mongoose.Types.ObjectId();
  let permitir = false;
  const consumidor = async () => {
    await Promise.resolve();
    return permitir;
  };
  eventBus.on("VENTA_COMPLETADA", consumidor);
  try {
    await OutboxEvent.init();
    const evento = await OutboxEvent.create({
      empresaId, aggregateId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId: aggregateId }
    });
    await assert.rejects(despacharSiguienteVenta(), /OUTBOX_CONSUMIDOR_RECHAZO_ENTREGA/);
    const pendiente = await OutboxEvent.findById(evento._id).lean();
    assert.equal(pendiente.estado, "PENDIENTE");
    assert.equal(pendiente.intentos, 1);
    permitir = true;
    assert.equal((await despacharSiguienteVenta()).entregado, true);
    const entregado = await OutboxEvent.findById(evento._id).lean();
    assert.equal(entregado.estado, "ENTREGADO");
    assert.equal(entregado.intentos, 2);
  } finally {
    eventBus.off("VENTA_COMPLETADA", consumidor);
    await mongoose.disconnect();
  }
});
