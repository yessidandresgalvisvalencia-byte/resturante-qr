"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("fiscal delivery prepares a draft exactly once without closing Caja or shared outbox", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Empresa = require("../../models/Empresa");
  const Venta = require("../../models/Venta");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const Receipt = require("../../models/GrukEventoProcesado");
  const Documento = require("../../core/facturacion/FacturacionDocumento");
  const { procesarEntregaFacturacion } = require("../../core/facturacion/procesarEntregaFacturacion.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_fiscal_independent_delivery_test" });
  try {
    await Promise.all([Empresa.init(), Venta.init(), Outbox.init(), Entrega.init(), Receipt.init(), Documento.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    await Empresa.collection.insertOne({ _id: empresaId, nombre: "Empresa CI", correo: "ci@example.test" });
    await Venta.collection.insertOne({
      _id: ventaId, empresaId, estado: "pagada", concepto: "Venta CI",
      cantidad: 1, precioUnitario: 12000, total: 12000, metodoPago: "efectivo",
      fecha: new Date()
    });
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId, total: 12000 }
    });
    await Entrega.create([
      { empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" },
      { empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1" }
    ], { ordered: true });
    const first = await procesarEntregaFacturacion({ empresaId, eventId: event._id });
    assert.equal(first.procesado, true);
    assert.equal(await Documento.countDocuments({ empresaId, ventaId, deletedAt: null }), 1);
    assert.equal(await Receipt.countDocuments({
      empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1"
    }), 1);
    assert.equal((await Entrega.findOne({ eventId: event._id, consumidor: "FACTURACION_VENTA_V1" })).estado, "ENTREGADO");
    assert.equal((await Entrega.findOne({ eventId: event._id, consumidor: "CAJA_VENTA_V1" })).estado, "PENDIENTE");
    assert.equal((await Outbox.findById(event._id)).estado, "PENDIENTE");
    const again = await procesarEntregaFacturacion({ empresaId, eventId: event._id });
    assert.equal(again.procesado, false);
    assert.equal(await Documento.countDocuments({ empresaId, ventaId, deletedAt: null }), 1);
  } finally {
    await mongoose.disconnect();
  }
});
