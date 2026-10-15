"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("expired lease recovery prevents stale worker from acknowledging delivery", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_stale_lease" });
  let releaseFirst;
  let signalFirst;
  const firstEntered = new Promise(resolve => { signalFirst = resolve; });
  const waitFirst = new Promise(resolve => { releaseFirst = resolve; });
  try {
    await OutboxEvent.init();
    const empresaId = new mongoose.Types.ObjectId();
    const aggregateId = new mongoose.Types.ObjectId();
    const evento = await OutboxEvent.create({
      empresaId, aggregateId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId: aggregateId }
    });
    const t0 = new Date("2026-10-15T00:00:00.000Z");
    const workerA = despacharSiguienteVenta({
      now: t0,
      emitir: async () => { signalFirst(); await waitFirst; }
    });
    await firstEntered;
    const workerB = await despacharSiguienteVenta({
      now: new Date(t0.getTime() + 61_000),
      emitir: async () => true
    });
    assert.equal(workerB.entregado, true);
    releaseFirst();
    const staleResult = await workerA;
    assert.equal(staleResult.entregado, false);
    const almacenado = await OutboxEvent.findById(evento._id).lean();
    assert.equal(almacenado.estado, "ENTREGADO");
    assert.equal(almacenado.intentos, 2);
  } finally {
    releaseFirst?.();
    await mongoose.disconnect();
  }
});
