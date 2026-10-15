"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("consumer rejects inconsistent tenant and sale payload without side effects", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const OutboxEvent = require("../../models/GrukOutboxEvent");
  const Recibo = require("../../models/GrukEventoProcesado");
  const { consumirEventoUnaVez } = require("../../core/eventos/consumidorIdempotente.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_ci_consumer_identity" });
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  const otroTenant = new mongoose.Types.ObjectId();
  const otraVenta = new mongoose.Types.ObjectId();
  let efectos = 0;
  const aplicar = async () => { efectos += 1; };
  try {
    await Promise.all([OutboxEvent.init(), Recibo.init()]);
    for (const [aggregateId, payload] of [
      [ventaId, { empresaId: otroTenant, ventaId }],
      [otraVenta, { empresaId, ventaId }]
    ]) {
      const evento = await OutboxEvent.create({
        empresaId, aggregateId, eventName: "VENTA_COMPLETADA", payload
      });
      await assert.rejects(
        consumirEventoUnaVez({ eventId: evento._id, empresaId, consumidor: "ci-identity", aplicar }),
        /CONSUMIDOR_PAYLOAD_IDENTIDAD_INCONSISTENTE/
      );
      assert.equal(await Recibo.countDocuments({ eventId: evento._id }), 0);
    }
    assert.equal(efectos, 0);
  } finally {
    await mongoose.disconnect();
  }
});
