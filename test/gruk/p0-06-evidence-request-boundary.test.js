"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyMovementEvidence } = require("../../core/finanzas/verificacionSoportesP006");

test("P0-06 rejects request accessors without invoking them", () => {
  let invoked = 0;
  const request = { empresaId: "empresa1", sedeId: "sede1", evidence: [] };
  Object.defineProperty(request, "movements", { enumerable: true, get() { invoked++; throw Error("accessed"); } });
  assert.throws(() => verifyMovementEvidence(request), /P006_SOPORTE_CAMPO_INVALIDO_movements/);
  assert.equal(invoked, 0);
});

test("P0-06 rejects inherited request collections", () => {
  const request = Object.create({ movements: [] });
  Object.assign(request, { empresaId: "empresa1", sedeId: "sede1", evidence: [] });
  assert.throws(() => verifyMovementEvidence(request), /P006_SOPORTE_CAMPO_INVALIDO_movements/);
});

test("P0-06 preserves valid evidence reconciliation", () => {
  const result = verifyMovementEvidence({
    empresaId: "empresa1", sedeId: "sede1",
    movements: [{ empresaId: "empresa1", sedeId: "sede1", idempotencyKey: "tx1", soporteId: "doc1" }],
    evidence: [{ empresaId: "empresa1", sedeId: "sede1", soporteId: "doc1" }]
  });
  assert.equal(result.unsupportedCount, 0);
});
