"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileMovements } = require("../../core/finanzas/reconciliacionExacta");
const input = (movements, expectedCentavos = "0") => ({ empresaId: "empresa-a", sedeId: "sede-1", movements, expectedCentavos });
const movement = (idempotencyKey, centavos, empresaId = "empresa-a", sedeId = "sede-1") => ({ idempotencyKey, centavos, empresaId, sedeId });

test("P0-06 sums exact centavos, reports differences and no floats", () => {
  const result = reconcileMovements(input([movement("sale:1", "9007199254740991"), movement("refund:1", "-9007199254740990")], "2"));
  assert.equal(result.actualCentavos, "1");
  assert.equal(result.differenceCentavos, "1");
  assert.equal(result.balanced, false);
  assert.equal(typeof result.actualCentavos, "string");
});

test("P0-06 retries do not double count and conflicting retries fail closed", () => {
  const result = reconcileMovements(input([movement("sale:1", "125"), movement("sale:1", "125")], "125"));
  assert.equal(result.balanced, true);
  assert.equal(result.uniqueMovements, 1);
  assert.deepEqual(result.duplicateKeys, ["sale:1"]);
  assert.throws(() => reconcileMovements(input([movement("sale:1", "125"), movement("sale:1", "126")])), /IDEMPOTENCIA_CONFLICTO/);
});

test("P0-06 rejects cross-tenant and cross-site movements", () => {
  assert.throws(() => reconcileMovements(input([movement("x", "10", "empresa-b")])), /TENANT_INCORRECTO/);
  assert.throws(() => reconcileMovements(input([movement("x", "10", "empresa-a", "sede-2")])), /TENANT_INCORRECTO/);
});

test("P0-06 rejects numeric amounts, malformed ids and unbounded input", () => {
  for (const amount of [1, 0.1, "1.00", "01", "1e3", "9007199254740992", "-0", null]) {
    assert.throws(() => reconcileMovements(input([movement("x", amount)])), /MONTO_(INVALIDO|RANGO)/);
  }
  assert.throws(() => reconcileMovements(input([movement("", "1")])), /ID_INVALIDO/);
  assert.throws(() => reconcileMovements(input([], 0)), /MONTO_INVALIDO/);
  assert.throws(() => reconcileMovements(input(new Array(10001))), /MOVIMIENTOS_INVALIDOS/);
});

test("P0-06 rejects inherited scope and identity from prototype payloads", () => {
  const inherited = Object.create({ empresaId: "empresa-a", sedeId: "sede-1", idempotencyKey: "inherited", centavos: "100" });
  assert.throws(() => reconcileMovements(input([inherited], "100")), /CAMPO_PROPIO_FALTANTE/);
  for (const missing of ["empresaId", "sedeId", "idempotencyKey", "centavos"]) {
    const candidate = movement("own", "100");
    const prototype = { [missing]: candidate[missing] };
    delete candidate[missing];
    Object.setPrototypeOf(candidate, prototype);
    assert.throws(() => reconcileMovements(input([candidate], "100")), /CAMPO_PROPIO_FALTANTE/);
  }
  assert.equal(reconcileMovements(input([movement("own", "100")], "100")).balanced, true);
});

test("P0-06 rejects aggregate overflow even when each movement is in range", () => {
  const max = "9007199254740991";
  assert.throws(() => reconcileMovements(input([movement("one", max), movement("two", "1")])), /TOTAL_RANGO/);
  assert.throws(() => reconcileMovements(input([movement("one", "-" + max), movement("two", "-1")])), /TOTAL_RANGO/);
  assert.equal(reconcileMovements(input([movement("one", max), movement("two", "-" + max)], "0")).balanced, true);
});
