"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("concurrent close attempts produce one global delivery transition", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { cerrarVentaEntregada } = require("../../core/eventos/cerrarVentaEntregada.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_outbox_concurrent_close_test" });
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
    const attempts = await Promise.allSettled(Array.from({ length: 8 },
      () => cerrarVentaEntregada({ empresaId, eventId: event._id })));
    const successes = attempts.filter(x => x.status === "fulfilled" && x.value.cerrado);
    assert.equal(successes.length, 1, "only one transaction may close the outbox");
    assert.equal((await Outbox.findById(event._id)).estado, "ENTREGADO");
    assert.equal(await Entrega.countDocuments({ eventId: event._id, estado: "ENTREGADO" }), 2);
    assert.equal((await cerrarVentaEntregada({ empresaId, eventId: event._id })).yaEntregado, true);
  } finally {
    await mongoose.disconnect();
  }
});
