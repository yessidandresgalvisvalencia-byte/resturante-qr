"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileMovements } = require("../../core/finanzas/reconciliacionExacta");

const entry = (idempotencyKey, centavos, sedeId = "sede-1") => ({
  empresaId: "empresa-a", sedeId, idempotencyKey, centavos
});
const reconcile = (movements, expectedCentavos = "0") =>
  reconcileMovements({ empresaId: "empresa-a", sedeId: "sede-1", movements, expectedCentavos });

test("P0-06 rejects aggregate amounts outside the supported safe-cent boundary", () => {
  const max = "9007199254740991";
  assert.throws(() => reconcile([entry("a", max), entry("b", max)]), /CONCILIACION_TOTAL_RANGO/);
  assert.throws(() => reconcile([entry("a", "-" + max), entry("b", "-" + max)]), /CONCILIACION_TOTAL_RANGO/);
  const result = reconcile([entry("a", max), entry("b", "-" + max)], "0");
  assert.equal(result.actualCentavos, "0");
  assert.equal(result.differenceCentavos, "0");
  assert.equal(result.uniqueMovements, 2);
  assert.equal(result.balanced, true);
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


test("P0-06 rejects discrepancies beyond the safe-cent contract", () => {
  const max = "9007199254740991";
  assert.throws(() => reconcile([entry("debit", "-" + max)], max), /CONCILIACION_DIFERENCIA_RANGO/);
  assert.throws(() => reconcile([entry("credit", max)], "-" + max), /CONCILIACION_DIFERENCIA_RANGO/);
  assert.equal(reconcile([entry("credit", max)], "0").differenceCentavos, "-" + max);
  assert.equal(reconcile([entry("debit", "-" + max)], "0").differenceCentavos, max);
});
