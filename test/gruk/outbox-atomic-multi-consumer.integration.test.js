"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("partial consumer failure retries without duplicating committed ledger effects", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const Receipt = require("../../models/GrukEventoProcesado");
  const eventBus = require("../../core/eventos/eventBus");
  const { consumirEventoUnaVez } = require("../../core/eventos/consumidorIdempotente.service");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_atomic_multi_consumer" });
  const efectos = mongoose.connection.db.collection("gruk_ci_financial_effects");
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  let fallarSegundo = true;
  const ledger = async envelope => consumirEventoUnaVez({
    eventId: envelope.metadata.eventId,
    empresaId: envelope.metadata.empresaId,
    consumidor: "ci-ledger",
    aplicar: async ({ evento, session }) => {
      await efectos.insertOne({ empresaId, eventId: evento._id, tipo: "ledger" }, { session });
    }
  });
  const finanzas = async envelope => consumirEventoUnaVez({
    eventId: envelope.metadata.eventId,
    empresaId: envelope.metadata.empresaId,
    consumidor: "ci-finanzas",
    aplicar: async ({ evento, session }) => {
      await efectos.insertOne({ empresaId, eventId: evento._id, tipo: "finanzas" }, { session });
      if (fallarSegundo) throw new Error("FALLO_FINANZAS_TRANSACCIONAL");
    }
  });
  eventBus.on("VENTA_COMPLETADA", ledger);
  eventBus.on("VENTA_COMPLETADA", finanzas);
  try {
    await Promise.all([OutboxEvent.init(), Receipt.init()]);
    const evento = await OutboxEvent.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    await assert.rejects(despacharSiguienteVenta(), /FALLO_FINANZAS_TRANSACCIONAL/);
    assert.equal((await OutboxEvent.findById(evento._id)).estado, "PENDIENTE");
    assert.equal(await efectos.countDocuments({ eventId: evento._id, tipo: "ledger" }), 1);
    assert.equal(await efectos.countDocuments({ eventId: evento._id, tipo: "finanzas" }), 0);
    fallarSegundo = false;
    assert.equal((await despacharSiguienteVenta()).entregado, true);
    assert.equal(await efectos.countDocuments({ eventId: evento._id, tipo: "ledger" }), 1);
    assert.equal(await efectos.countDocuments({ eventId: evento._id, tipo: "finanzas" }), 1);
    assert.equal(await Receipt.countDocuments({ eventId: evento._id }), 2);
  } finally {
    eventBus.off("VENTA_COMPLETADA", ledger);
    eventBus.off("VENTA_COMPLETADA", finanzas);
    await mongoose.disconnect();
  }
});
