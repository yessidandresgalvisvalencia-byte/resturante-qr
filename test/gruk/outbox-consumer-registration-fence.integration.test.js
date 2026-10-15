"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("late consumer registration is rejected after global delivery", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { registrarConsumidorAdicional } = require("../../core/eventos/registrarConsumidorAdicional.service");
  const { cerrarVentaEntregada } = require("../../core/eventos/cerrarVentaEntregada.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_outbox_registration_fence_test" });
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
    assert.deepEqual(await registrarConsumidorAdicional({
      empresaId, eventId: event._id, consumidor: "AUDITORIA_VENTA_V1"
    }), { registrada: true });
    assert.equal((await Outbox.findById(event._id)).registroVersion, 1);
    assert.equal((await cerrarVentaEntregada({ empresaId, eventId: event._id })).cerrado, false);
    await Entrega.updateOne({ eventId: event._id, consumidor: "AUDITORIA_VENTA_V1" },
      { $set: { estado: "ENTREGADO" } });
    assert.equal((await cerrarVentaEntregada({ empresaId, eventId: event._id })).cerrado, true);
    await assert.rejects(
      registrarConsumidorAdicional({ empresaId, eventId: event._id, consumidor: "NUEVO_CONSUMIDOR_V1" }),
      /OUTBOX_REGISTRO_EVENTO_NO_PENDIENTE/
    );
    assert.equal(await Entrega.countDocuments({ eventId: event._id }), 3);
  } finally {
    await mongoose.disconnect();
  }
});
