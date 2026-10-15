"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { reclamarVentaConciliada } = require("../../core/finanzas/services/reclamarVentaConciliada.service");

test("financial claim refuses missing MongoDB transaction", async () => {
  await assert.rejects(
    reclamarVentaConciliada({
      empresaId: new mongoose.Types.ObjectId(),
      sedeId: new mongoose.Types.ObjectId(),
      ventaId: new mongoose.Types.ObjectId(),
      token: "orden:prueba:123456"
    }),
    { message: "ORDEN_FINANCIERA_TRANSACCION_REQUERIDA" }
  );
});

test("financial claim rejects invalid tenant identifiers before reading", async () => {
  const client = mongoose.connection.getClient();
  const session = { inTransaction: () => true, client };
  await assert.rejects(
    reclamarVentaConciliada({
      empresaId: "invalid",
      sedeId: new mongoose.Types.ObjectId(),
      ventaId: new mongoose.Types.ObjectId(),
      token: "orden:prueba:123456",
      session
    }),
    { message: "ORDEN_FINANCIERA_IDENTIDAD_INVALIDA" }
  );
});

test("financial claim rejects unsafe tokens before reading", async () => {
  const client = mongoose.connection.getClient();
  const session = { inTransaction: () => true, client };
  await assert.rejects(
    reclamarVentaConciliada({
      empresaId: new mongoose.Types.ObjectId(),
      sedeId: new mongoose.Types.ObjectId(),
      ventaId: new mongoose.Types.ObjectId(),
      token: "$bad",
      session
    }),
    { message: "ORDEN_FINANCIERA_TOKEN_INVALIDO" }
  );
});
