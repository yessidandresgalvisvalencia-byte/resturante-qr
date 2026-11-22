"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyMovementEvidence } = require("../../core/finanzas/verificacionSoportesP006");
const scope = { empresaId: "empresaA", sedeId: "sede1" };
const m = (key, soporteId, extra = {}) => ({ ...scope, idempotencyKey: key, soporteId, ...extra });
const s = (soporteId, extra = {}) => ({ ...scope, soporteId, ...extra });
test("P0-06 reports missing and absent evidence deterministically", () => {
  const result = verifyMovementEvidence({ ...scope, movements: [m("z", "factura2"), m("a", null), m("b", "factura1")], evidence: [s("factura1")] });
  assert.deepEqual(result.unsupportedMovementKeys, ["a", "z"]);
  assert.equal(result.unsupportedCount, 2);
});
test("P0-06 rejects evidence from another tenant even if reference matches", () => {
  assert.throws(() => verifyMovementEvidence({ ...scope, movements: [m("x", "factura1")], evidence: [s("factura1", { empresaId: "empresaB" })] }), /TENANT/);
});
test("P0-06 rejects cross-sede movements", () => {
  assert.throws(() => verifyMovementEvidence({ ...scope, movements: [m("x", null, { sedeId: "sede2" })], evidence: [] }), /TENANT/);
});
test("P0-06 rejects duplicated evidence references", () => {
  assert.throws(() => verifyMovementEvidence({ ...scope, movements: [], evidence: [s("f1"), s("f1")] }), /DUPLICADO/);
});
test("P0-06 rejects accessor properties without evaluating them", () => {
  const record = m("x", "f1");
  Object.defineProperty(record, "soporteId", { get() { throw Error("getter executed"); } });
  assert.throws(() => verifyMovementEvidence({ ...scope, movements: [record], evidence: [] }), /CAMPO_INVALIDO/);
});
