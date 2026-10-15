"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("retry triage isolates tenant, reports cooldown and advisory quarantine without mutation", {
  skip: !process.env.TEST_MONGO_URI
}, async () => {
  const mongoose = require("mongoose");
  const Entrega = require("../../models/GrukEntregaConsumidor");
  const { diagnosticarReintentosEntrega } =
    require("../../core/eventos/diagnosticarReintentosEntrega.service");
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: "gruk_retry_triage_test" });
  try {
    await Entrega.init();
    const empresaId = new mongoose.Types.ObjectId();
    const foreign = new mongoose.Types.ObjectId();
    const now = new Date();
    const [pending, exhausted] = await Entrega.insertMany([
      { empresaId, eventId: new mongoose.Types.ObjectId(), consumidor: "CAJA_VENTA_V1",
        estado: "PENDIENTE", intentos: 1 },
      { empresaId, eventId: new mongoose.Types.ObjectId(), consumidor: "CAJA_VENTA_V1",
        estado: "PENDIENTE", intentos: 8 },
      { empresaId: foreign, eventId: new mongoose.Types.ObjectId(), consumidor: "CAJA_VENTA_V1",
        estado: "PENDIENTE", intentos: 8 }
    ]);
    const report = await diagnosticarReintentosEntrega({
      empresaId, consumidor: "CAJA_VENTA_V1", now, limit: 10
    });
    assert.equal(report.examinadas, 2);
    const retry = report.diagnosticos.find(x => x.eventId === String(pending.eventId));
    assert.equal(retry.accion, "REINTENTAR");
    assert.equal(retry.listoAhora, false);
    const quarantine = report.diagnosticos.find(x => x.eventId === String(exhausted.eventId));
    assert.equal(quarantine.accion, "CUARENTENA_RECOMENDADA");
    assert.equal(quarantine.listoAhora, false);
    assert.equal((await Entrega.findById(exhausted._id)).estado, "PENDIENTE");
    await assert.rejects(diagnosticarReintentosEntrega({
      empresaId, consumidor: "INVALID"
    }), /ENTREGA_DIAGNOSTICO_PARAMETROS_INVALIDOS/);
  } finally {
    await mongoose.disconnect();
  }
});
