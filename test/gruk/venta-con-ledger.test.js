"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { registrarVentaConLedger } = require("../../core/finanzas/services/ventaConLedger.service");

test("sale and ledger cannot run outside a shared transaction", async () => {
  await assert.rejects(registrarVentaConLedger(), /VENTA_LEDGER_TRANSACCION_REQUERIDA/);
  await assert.rejects(registrarVentaConLedger({}), /VENTA_LEDGER_TRANSACCION_REQUERIDA/);
  await assert.rejects(registrarVentaConLedger({
    session: { inTransaction: () => false }
  }), /VENTA_LEDGER_TRANSACCION_REQUERIDA/);
});

test("sale and ledger reject an unrelated MongoDB client session", async () => {
  await assert.rejects(registrarVentaConLedger({
    session: { inTransaction: () => true, client: {} }
  }), /VENTA_LEDGER_TRANSACCION_REQUERIDA/);
});

test("sale-ledger validates identities before accessing order data", async () => {
  const mongoose = require("mongoose");
  const session = { inTransaction: () => true, client: mongoose.connection.getClient() };
  await assert.rejects(registrarVentaConLedger({ session }),
    /VENTA_LEDGER_IDENTIDAD_INVALIDA/);
});
