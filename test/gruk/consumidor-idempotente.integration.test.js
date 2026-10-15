"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("consumer effects and receipt commit once, and rollback together", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const Recibo = require("../../models/GrukEventoProcesado");
  const { consumirEventoUnaVez } = require("../../core/eventos/consumidorIdempotente.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_consumer_once" });
  const ColeccionEfectos = mongoose.connection.db.collection("gruk_consumer_test_effects");
  try {
    await Promise.all([OutboxEvent.init(), Recibo.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const evento = await OutboxEvent.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { ventaId, empresaId }
    });
    const consumidor = "ci-ledger-" + ventaId;
    const aplicar = async ({ evento: actual, session }) => {
      await ColeccionEfectos.insertOne({
        empresaId, eventId: actual._id, ventaId
      }, { session });
    };
    const first = await consumirEventoUnaVez({
      eventId: evento._id, empresaId, consumidor, aplicar
    });
    assert.equal(first.aplicado, true);
    const replay = await consumirEventoUnaVez({
      eventId: evento._id, empresaId, consumidor, aplicar
    });
    assert.equal(replay.duplicado, true);
    assert.equal(await ColeccionEfectos.countDocuments({ eventId: evento._id }), 1);
    assert.equal(await Recibo.countDocuments({ eventId: evento._id, consumidor }), 1);

    const fallidoId = new mongoose.Types.ObjectId();
    const fallido = await OutboxEvent.create({
      empresaId, aggregateId: fallidoId, eventName: "VENTA_COMPLETADA",
      payload: { ventaId: fallidoId, empresaId }
    });
    await assert.rejects(consumirEventoUnaVez({
      eventId: fallido._id, empresaId, consumidor,
      aplicar: async ({ session }) => {
        await ColeccionEfectos.insertOne({ empresaId, eventId: fallido._id }, { session });
        throw new Error("FALLO_ANTES_DEL_COMMIT");
      }
    }), /FALLO_ANTES_DEL_COMMIT/);
    assert.equal(await ColeccionEfectos.countDocuments({ eventId: fallido._id }), 0);
    assert.equal(await Recibo.countDocuments({ eventId: fallido._id, consumidor }), 0);
  } finally {
    await mongoose.disconnect();
  }
});
