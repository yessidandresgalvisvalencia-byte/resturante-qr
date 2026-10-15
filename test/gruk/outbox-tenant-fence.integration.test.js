"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("cross-tenant close and additional consumer registration are denied", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { registrarConsumidorAdicional } = require("../../core/eventos/registrarConsumidorAdicional.service");
  const { cerrarVentaEntregada } = require("../../core/eventos/cerrarVentaEntregada.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_outbox_tenant_fence_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const atacanteId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    await Entrega.create([
      { empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1", estado: "ENTREGADO" },
      { empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1", estado: "ENTREGADO" }
    ], { ordered: true });
    await assert.rejects(
      cerrarVentaEntregada({ empresaId: atacanteId, eventId: event._id }),
      /OUTBOX_CIERRE_EVENTO_INVALIDO/
    );
    await assert.rejects(
      registrarConsumidorAdicional({
        empresaId: atacanteId, eventId: event._id, consumidor: "AUDITORIA_VENTA_V1"
      }),
      /OUTBOX_REGISTRO_EVENTO_NO_PENDIENTE/
    );
    assert.equal((await Outbox.findById(event._id)).estado, "PENDIENTE");
    assert.equal(await Entrega.countDocuments({ eventId: event._id }), 2);
  } finally {
    await mongoose.disconnect();
  }
});
