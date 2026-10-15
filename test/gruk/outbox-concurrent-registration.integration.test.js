"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("concurrent duplicate consumer registration never creates two obligations", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { registrarConsumidorAdicional } = require("../../core/eventos/registrarConsumidorAdicional.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_outbox_registration_concurrent_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    const args = { empresaId, eventId: event._id, consumidor: "AUDITORIA_VENTA_V1" };
    const results = await Promise.allSettled(Array.from({ length: 8 },
      () => registrarConsumidorAdicional(args)));
    assert.ok(results.some(x => x.status === "fulfilled" && x.value.registrada));
    assert.equal(await Entrega.countDocuments({
      empresaId, eventId: event._id, consumidor: args.consumidor
    }), 1);
    assert.equal((await Outbox.findById(event._id)).estado, "PENDIENTE");
    assert.deepEqual(await registrarConsumidorAdicional(args),
      { registrada: false, existente: true });
  } finally {
    await mongoose.disconnect();
  }
});
