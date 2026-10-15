"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("sale outbox creates independent delivery obligations atomically", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { registrarVentaEnOutbox } = require("../../core/eventos/ventaOutbox.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_delivery_atomic_test" });
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  const venta = {
    _id: ventaId, empresaId, origen: "PEDIDO", cantidad: 1,
    precioUnitario: 12000, total: 12000, costoUnitario: 0,
    costoTotal: 0, utilidadBruta: 12000, margenBruto: 100,
    metodoPago: "EFECTIVO", concepto: "Prueba", fecha: new Date()
  };
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await registrarVentaEnOutbox(venta, session);
      });
    } finally {
      await session.endSession();
    }
    const event = await Outbox.findOne({ empresaId, aggregateId: ventaId }).lean();
    assert.ok(event);
    const entregas = await Entrega.find({ empresaId, eventId: event._id }).lean();
    assert.deepEqual(entregas.map(x => x.consumidor).sort(),
      ["CAJA_VENTA_V1", "FACTURACION_VENTA_V1"]);
    assert.ok(entregas.every(x => x.estado === "PENDIENTE"));
  } finally {
    await mongoose.disconnect();
  }
});
