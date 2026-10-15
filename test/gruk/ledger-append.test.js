"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { GENESIS, hashMovimiento, registrarMovimiento } =
  require("../../core/finanzas/services/ledgerAppend.service");

test("ledger hash is deterministic and binds tenant, account, amount and previous hash", () => {
  const d = {
    empresaId: "507f1f77bcf86cd799439011", sedeId: "507f1f77bcf86cd799439012",
    cuenta: "CAJA", secuencia: 1, tipo: "ABONO", moneda: "COP",
    montoMenor: "5200000", saldoAntesMenor: "0", saldoDespuesMenor: "5200000",
    actorId: "507f1f77bcf86cd799439013", ip: "127.0.0.1",
    claveIdempotencia: "pago-evento-0001", hashAnterior: GENESIS
  };
  assert.equal(hashMovimiento(d), hashMovimiento({ ...d }));
  assert.notEqual(hashMovimiento(d), hashMovimiento({ ...d, montoMenor: "5200001" }));
  assert.notEqual(hashMovimiento(d), hashMovimiento({ ...d, empresaId: "507f1f77bcf86cd799439014" }));
  assert.notEqual(hashMovimiento(d), hashMovimiento({ ...d, hashAnterior: "a".repeat(64) }));
  assert.notEqual(hashMovimiento(d), hashMovimiento({ ...d, saldoDespuesMenor: "5200001" }));
  assert.notEqual(hashMovimiento(d), hashMovimiento({ ...d, cuenta: "OTRA_CAJA" }));
  assert.notEqual(hashMovimiento(d), hashMovimiento({ ...d, claveIdempotencia: "pago-evento-0002" }));
});

test("ledger refuses writes without a real Mongo transaction", async () => {
  const data = {
    empresaId: new mongoose.Types.ObjectId(), sedeId: new mongoose.Types.ObjectId(),
    actorId: new mongoose.Types.ObjectId(), cuenta: "CAJA", tipo: "ABONO",
    montoMenor: "1", ip: "127.0.0.1", claveIdempotencia: "event-0000001"
  };
  await assert.rejects(registrarMovimiento(data), /LEDGER_TRANSACCION_REQUERIDA/);
  await assert.rejects(registrarMovimiento({ ...data, montoMenor: "0.1" }), /LEDGER_ENTRADA_INVALIDA/);
  await assert.rejects(registrarMovimiento({ ...data, montoMenor: "0" }), /LEDGER_ENTRADA_INVALIDA/);
  await assert.rejects(registrarMovimiento({ ...data, montoMenor: "9".repeat(25) }), /LEDGER_ENTRADA_INVALIDA/);
  await assert.rejects(registrarMovimiento({ ...data, tipo: "CORRECCION" }), /LEDGER_ENTRADA_INVALIDA/);
  await assert.rejects(registrarMovimiento({ ...data, empresaId: undefined }), /LEDGER_IDENTIDAD_INVALIDA/);
  await assert.rejects(registrarMovimiento({ ...data, sedeId: undefined }), /LEDGER_IDENTIDAD_INVALIDA/);
  await assert.rejects(registrarMovimiento({ ...data, actorId: undefined }), /LEDGER_IDENTIDAD_INVALIDA/);
});
