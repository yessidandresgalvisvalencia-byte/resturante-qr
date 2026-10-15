"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("stale worker failure cannot reset a newer worker lease", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const { despacharSiguienteVenta } = require("../../core/eventos/ventaOutbox.dispatcher");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_outbox_stale_failure" });
  let releaseOld;
  let signalOld;
  const oldStarted = new Promise(resolve => { signalOld = resolve; });
  const oldPending = new Promise(resolve => { releaseOld = resolve; });
  try {
    await OutboxEvent.init();
    const empresaId = new mongoose.Types.ObjectId();
    const aggregateId = new mongoose.Types.ObjectId();
    const evento = await OutboxEvent.create({
      empresaId, aggregateId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId: aggregateId }
    });
    const t0 = new Date("2026-10-15T00:00:00.000Z");
    const oldWorker = despacharSiguienteVenta({
      now: t0,
      emitir: async () => {
        signalOld();
        await oldPending;
        throw new Error("WORKER_ANTIGUO_FALLIDO");
      }
    });
    await oldStarted;
    let releaseNew;
    let signalNew;
    const newStarted = new Promise(resolve => { signalNew = resolve; });
    const newPending = new Promise(resolve => { releaseNew = resolve; });
    const newWorker = despacharSiguienteVenta({
      now: new Date(t0.getTime() + 61_000),
      emitir: async () => { signalNew(); await newPending; return true; }
    });
    try {
      await newStarted;
      releaseOld();
      await assert.rejects(oldWorker, /WORKER_ANTIGUO_FALLIDO/);
      const inFlight = await OutboxEvent.findById(evento._id).lean();
      assert.equal(inFlight.estado, "PROCESANDO");
      assert.equal(inFlight.intentos, 2);
      assert.ok(inFlight.leaseToken);
      releaseNew();
      assert.equal((await newWorker).entregado, true);
      assert.equal((await OutboxEvent.findById(evento._id)).estado, "ENTREGADO");
    } finally {
      releaseOld?.();
      releaseNew?.();
      await Promise.allSettled([oldWorker, newWorker]);
    }
  } finally {
    await mongoose.disconnect();
  }
});
