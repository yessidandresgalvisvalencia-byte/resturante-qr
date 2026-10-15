"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("duplicate registration is idempotent and does not increment outbox version", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Outbox = require("../../models/GrukOutboxEvent");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { registrarConsumidorAdicional } = require("../../core/eventos/registrarConsumidorAdicional.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_outbox_registration_idempotency_test" });
  try {
    await Promise.all([Outbox.init(), Entrega.init()]);
    const empresaId = new mongoose.Types.ObjectId();
    const ventaId = new mongoose.Types.ObjectId();
    const event = await Outbox.create({
      empresaId, aggregateId: ventaId, eventName: "VENTA_COMPLETADA",
      payload: { empresaId, ventaId }
    });
    const args = { empresaId, eventId: event._id, consumidor: "AUDITORIA_VENTA_V1" };
    assert.deepEqual(await registrarConsumidorAdicional(args), { registrada: true });
    assert.deepEqual(await registrarConsumidorAdicional(args), {
      registrada: false, existente: true
    });
    assert.equal(await Entrega.countDocuments({ eventId: event._id, consumidor: args.consumidor }), 1);
    assert.equal((await Outbox.findById(event._id)).registroVersion, 1);
    await Outbox.updateOne({ _id: event._id }, { $set: { estado: "ENTREGADO" } });
    await assert.rejects(registrarConsumidorAdicional({
      empresaId, eventId: event._id, consumidor: "NUEVO_CONSUMIDOR_V1"
    }), /OUTBOX_REGISTRO_EVENTO_NO_PENDIENTE/);
    assert.equal(await Entrega.countDocuments({ eventId: event._id }), 1);
  } finally {
    await mongoose.disconnect();
  }
});
