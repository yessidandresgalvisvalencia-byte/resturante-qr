"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileMovements } = require("../../core/finanzas/reconciliacionExacta");

const envelope = (movements, expectedCentavos = "0") => ({
  empresaId: "tenant-a", sedeId: "site-1", movements, expectedCentavos
});
const entry = (idempotencyKey, centavos) => ({
  empresaId: "tenant-a", sedeId: "site-1", idempotencyKey, centavos
});

test("P0-06: reconciliation result and duplicate keys are immutable", () => {
  const result = reconcileMovements(envelope([entry("sale-1", "125"), entry("sale-1", "125")], "125"));
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.duplicateKeys), true);
  assert.throws(() => { result.actualCentavos = "0"; }, TypeError);
  assert.throws(() => result.duplicateKeys.push("forged"), TypeError);
  assert.equal(result.actualCentavos, "125");
  assert.deepEqual(result.duplicateKeys, ["sale-1"]);
});

test("P0-06: repeated retries never bypass a conflicting idempotency key", () => {
  assert.throws(() => reconcileMovements(envelope([
    entry("sale-1", "125"), entry("sale-1", "125"), entry("sale-1", "-125")
  ], "125")), /CONCILIACION_IDEMPOTENCIA_CONFLICTO/);
});

test("P0-06: invalid scope cannot be hidden behind a duplicate idempotency key", () => {
  const foreign = { ...entry("sale-1", "125"), empresaId: "tenant-b" };
  assert.throws(() => reconcileMovements(envelope([
    entry("sale-1", "125"), foreign
  ], "125")), /CONCILIACION_TENANT_INCORRECTO/);
});
