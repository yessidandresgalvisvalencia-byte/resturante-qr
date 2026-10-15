"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { reclamarEntrega, confirmarEntrega, liberarEntrega } =
  require("../../core/eventos/entregaConsumidor.service");

test("per-consumer lease service rejects malformed tenant and event identities", async () => {
  await assert.rejects(reclamarEntrega({
    eventId: "invalid", empresaId: "invalid", consumidor: "CAJA_VENTA_V1"
  }), /ENTREGA_IDENTIDAD_INVALIDA/);
  await assert.rejects(confirmarEntrega({
    eventId: "invalid", empresaId: "invalid", consumidor: "CAJA_VENTA_V1",
    leaseToken: "token"
  }), /ENTREGA_CONFIRMACION_INVALIDA/);
  await assert.rejects(liberarEntrega({
    eventId: "invalid", empresaId: "invalid", consumidor: "CAJA_VENTA_V1",
    leaseToken: "token"
  }), /ENTREGA_LIBERACION_INVALIDA/);
});

test("per-consumer lease service rejects invalid time", async () => {
  const mongoose = require("mongoose");
  const eventId = new mongoose.Types.ObjectId();
  const empresaId = new mongoose.Types.ObjectId();
  await assert.rejects(reclamarEntrega({
    eventId, empresaId, consumidor: "CAJA_VENTA_V1", now: new Date(NaN)
  }), /ENTREGA_FECHA_INVALIDA/);
});
