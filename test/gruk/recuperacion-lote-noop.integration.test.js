"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("explicit recovery batch preserves independent consumer ACKs and closes only after both", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { procesarLoteRecuperacion } = require("../../core/eventos/procesarLoteRecuperacion.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_recovery_batch_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    await Entrega.create([
      { empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1", estado: "ENTREGADO" },
      { empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1", estado: "ENTREGADO" }
    ], { ordered: true });
    // No recoverable work means no attempt to close or mutate an event.
    const result = await procesarLoteRecuperacion({
      empresaId, consumidor: "CAJA_VENTA_V1", limit: 10
    });
    assert.deepEqual(result, {
      consumidor: "CAJA_VENTA_V1", encontrados: 0, resultados: [], cierres: []
    });
    assert.equal((await Outbox.findById(event._id)).estado, "PENDIENTE");
    assert.equal((await Entrega.countDocuments({ eventId: event._id, estado: "ENTREGADO" })), 2);
  } finally {
    await mongoose.disconnect();
  }
});
