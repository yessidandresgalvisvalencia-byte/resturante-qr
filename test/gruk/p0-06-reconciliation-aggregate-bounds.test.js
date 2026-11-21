"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileMovements } = require("../../core/finanzas/reconciliacionExacta");

const entry = (idempotencyKey, centavos, sedeId = "sede-1") => ({
  empresaId: "empresa-a", sedeId, idempotencyKey, centavos
});
const reconcile = (movements, expectedCentavos = "0") =>
  reconcileMovements({ empresaId: "empresa-a", sedeId: "sede-1", movements, expectedCentavos });

test("P0-06 retains exact totals above Number.MAX_SAFE_INTEGER", () => {
  const result = reconcile([entry("a", "9007199254740991"), entry("b", "9007199254740991")]);
  assert.equal(result.actualCentavos, "18014398509481982");
  assert.equal(result.differenceCentavos, "-18014398509481982");
  assert.equal(result.uniqueMovements, 2);
  assert.equal(result.balanced, false);
  assert.equal(typeof result.actualCentavos, "string");
});

test("P0-06 rejects conflicting negative retries and cross-sede duplicate keys", () => {
  assert.throws(() => reconcile([entry("refund", "-100"), entry("refund", "100")]), /IDEMPOTENCIA_CONFLICTO/);
  assert.throws(() => reconcile([entry("sale", "100"), entry("sale", "100", "sede-2")]), /TENANT_INCORRECTO/);
});

test("P0-06 empty journal is balanced only against zero and result is immutable", () => {
  const result = reconcile([], "0");
  assert.equal(result.balanced, true);
  assert.equal(result.actualCentavos, "0");
  assert.equal(result.differenceCentavos, "0");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.duplicateKeys), true);
  assert.equal(reconcile([], "1").balanced, false);
});
