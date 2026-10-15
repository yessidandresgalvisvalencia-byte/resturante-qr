"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("outbox dispatcher retries failed delivery without losing durable event", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_dispatch" });
  try {
    await OutboxEvent.init();
    const empresaId = new mongoose.Types.ObjectId();
    const aggregateId = new mongoose.Types.ObjectId();
    const evento = await OutboxEvent.create({
      empresaId, aggregateId, eventName: "VENTA_COMPLETADA",
      payload: { ventaId: aggregateId, empresaId }
    });
    await assert.rejects(
      despacharSiguienteVenta({ emitir: () => { throw new Error("CONSUMIDOR_NO_DISPONIBLE"); } }),
      /CONSUMIDOR_NO_DISPONIBLE/
    );
    const pendiente = await OutboxEvent.findById(evento._id);
    assert.equal(pendiente.estado, "PENDIENTE");
    assert.equal(pendiente.intentos, 1);
    const recibidos = [];
    const entregado = await despacharSiguienteVenta({
      emitir: (nombre, payload) => recibidos.push({ nombre, payload })
    });
    assert.equal(entregado.entregado, true);
    assert.equal(recibidos.length, 1);
    assert.equal(recibidos[0].nombre, "VENTA_COMPLETADA");
    assert.equal(String(recibidos[0].payload.ventaId), String(aggregateId));
    assert.equal((await OutboxEvent.findById(evento._id)).estado, "ENTREGADO");
    assert.equal((await OutboxEvent.findById(evento._id)).intentos, 2);
    const aggregateBloqueado = new mongoose.Types.ObjectId();
    const bloqueado = await OutboxEvent.create({
      empresaId, aggregateId: aggregateBloqueado, eventName: "VENTA_COMPLETADA",
      payload: { ventaId: aggregateBloqueado, empresaId },
      estado: "PROCESANDO",
      leaseHasta: new Date(Date.now() + 60_000),
      leaseToken: "otro-trabajador"
    });
    const noDisponible = await despacharSiguienteVenta({
      emitir: () => { throw new Error("NO_DEBE_EMITIR"); }
    });
    assert.equal(noDisponible.procesado, false);
    assert.equal((await OutboxEvent.findById(bloqueado._id)).intentos, 0);

    await OutboxEvent.updateOne({ _id: bloqueado._id }, {
      $set: { leaseHasta: new Date(Date.now() - 60_000) }
    });
    const recuperados = [];
    const recuperado = await despacharSiguienteVenta({
      emitir: (name, payload) => recuperados.push({ name, payload })
    });
    assert.equal(recuperado.entregado, true);
    assert.equal(recuperados.length, 1);
    assert.equal(String(recuperados[0].payload.ventaId), String(aggregateBloqueado));
    assert.equal((await OutboxEvent.findById(bloqueado._id)).estado, "ENTREGADO");

  } finally {
    await mongoose.disconnect();
  }
});
