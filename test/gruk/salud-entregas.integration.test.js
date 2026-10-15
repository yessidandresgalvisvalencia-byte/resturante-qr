"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("delivery health aggregates pending, delivered, expired leases and retries per tenant", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { obtenerSaludEntregas } = require("../../core/eventos/obtenerSaludEntregas.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_delivery_health_test" });
  try {
    await Entrega.init();
    const empresaId = new mongoose.Types.ObjectId();
    const foreign = new mongoose.Types.ObjectId();
    const now = new Date("2026-06-01T12:00:00.000Z");
    await Entrega.insertMany([
      { empresaId, eventId: new mongoose.Types.ObjectId(), consumidor: "CAJA_VENTA_V1",
        estado: "PENDIENTE" },
      { empresaId, eventId: new mongoose.Types.ObjectId(), consumidor: "CAJA_VENTA_V1",
        estado: "PROCESANDO", leaseHasta: new Date("2026-06-01T11:00:00.000Z"), intentos: 2 },
      { empresaId, eventId: new mongoose.Types.ObjectId(), consumidor: "FACTURACION_VENTA_V1",
        estado: "ENTREGADO", intentos: 1 },
      { empresaId: foreign, eventId: new mongoose.Types.ObjectId(), consumidor: "CAJA_VENTA_V1",
        estado: "PENDIENTE" }
    ]);
    const health = await obtenerSaludEntregas({ empresaId, now });
    assert.deepEqual(health.consumidores.CAJA_VENTA_V1, {
      PENDIENTE: 1, PROCESANDO: 1, ENTREGADO: 0, expirados: 1, reintentos: 1
    });
    assert.deepEqual(health.consumidores.FACTURACION_VENTA_V1, {
      PENDIENTE: 0, PROCESANDO: 0, ENTREGADO: 1, expirados: 0, reintentos: 0
    });
    assert.equal(await Entrega.countDocuments({ empresaId }), 3);
    await assert.rejects(obtenerSaludEntregas({ empresaId: "invalid" }),
      /ENTREGA_SALUD_PARAMETROS_INVALIDOS/);
  } finally {
    await mongoose.disconnect();
  }
});
