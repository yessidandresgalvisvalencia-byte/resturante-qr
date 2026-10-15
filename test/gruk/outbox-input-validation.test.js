"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("consumer registration rejects malformed identity and consumer names before database access", async () => {
  const { registrarConsumidorAdicional } = require("../../core/eventos/registrarConsumidorAdicional.service");
  const mongoose = require("mongoose");
  const empresaId = new mongoose.Types.ObjectId();
  const eventId = new mongoose.Types.ObjectId();
  for (const args of [
    { empresaId: "invalid", eventId, consumidor: "AUDITORIA_VENTA_V1" },
    { empresaId, eventId: "invalid", consumidor: "AUDITORIA_VENTA_V1" },
    { empresaId, eventId, consumidor: "" },
    { empresaId, eventId, consumidor: "auditoria_venta_v1" },
    { empresaId, eventId, consumidor: "A".repeat(81) },
    { empresaId, eventId, consumidor: null }
  ]) {
    await assert.rejects(registrarConsumidorAdicional(args), /OUTBOX_REGISTRO_CONSUMIDOR_INVALIDO/);
  }
});

test("global close rejects malformed tenant and event identifiers before database access", async () => {
  const { cerrarVentaEntregada } = require("../../core/eventos/cerrarVentaEntregada.service");
  const mongoose = require("mongoose");
  const empresaId = new mongoose.Types.ObjectId();
  const eventId = new mongoose.Types.ObjectId();
  await assert.rejects(cerrarVentaEntregada({ empresaId: "invalid", eventId }),
    /OUTBOX_CIERRE_IDENTIDAD_INVALIDA/);
  await assert.rejects(cerrarVentaEntregada({ empresaId, eventId: "invalid" }),
    /OUTBOX_CIERRE_IDENTIDAD_INVALIDA/);
});
