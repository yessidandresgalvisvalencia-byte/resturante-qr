"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("explicit recovery batch refuses exhausted retries without claiming lease", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { procesarLoteRecuperacion } = require("../../core/eventos/procesarLoteRecuperacion.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_batch_retry_guard_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    const delivery = await Entrega.create({
      empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1",
      estado: "PENDIENTE", intentos: 8
    });
    const result = await procesarLoteRecuperacion({
      empresaId, consumidor: "CAJA_VENTA_V1", limit: 10
    });
    assert.equal(result.encontrados, 1);
    assert.equal(result.resultados[0].omitido, true);
    assert.equal(result.resultados[0].motivo, "CUARENTENA_RECOMENDADA");
    const persisted = await Entrega.findById(delivery._id);
    assert.equal(persisted.estado, "PENDIENTE");
    assert.equal(persisted.intentos, 8);
    assert.equal((await Outbox.findById(event._id)).estado, "PENDIENTE");
  } finally {
    await mongoose.disconnect();
  }
});
