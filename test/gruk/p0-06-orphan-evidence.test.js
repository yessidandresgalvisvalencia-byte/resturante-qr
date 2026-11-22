"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyMovementEvidence } = require("../../core/finanzas/verificacionSoportesP006");

const movement = (idempotencyKey, soporteId, empresaId = "empresaA", sedeId = "sedeA") =>
  ({ empresaId, sedeId, idempotencyKey, soporteId });
const support = (soporteId, empresaId = "empresaA", sedeId = "sedeA") =>
  ({ empresaId, sedeId, soporteId });
const verify = (movements, evidence) =>
  verifyMovementEvidence({ empresaId: "empresaA", sedeId: "sedeA", movements, evidence });

test("P0-06 reports orphan evidence deterministically without changing missing movements", () => {
  const result = verify(
    [movement("mov-1", "support-1"), movement("mov-2", null)],
    [support("support-3"), support("support-1"), support("support-2")]
  );
  assert.deepEqual(result.unsupportedMovementKeys, ["mov-2"]);
  assert.equal(result.unsupportedCount, 1);
  assert.deepEqual(result.orphanEvidenceIds, ["support-2", "support-3"]);
  assert.equal(result.orphanEvidenceCount, 2);
  assert.ok(Object.isFrozen(result.orphanEvidenceIds));
  assert.ok(Object.isFrozen(result));
});

test("P0-06 shared support references are not incorrectly marked orphan", () => {
  const result = verify(
    [movement("mov-1", "support-1"), movement("mov-2", "support-1")],
    [support("support-1")]
  );
  assert.deepEqual(result.orphanEvidenceIds, []);
  assert.equal(result.orphanEvidenceCount, 0);
});

test("P0-06 rejects cross-tenant evidence rather than disclosing orphan IDs", () => {
  assert.throws(
    () => verify([movement("mov-1", "support-1")], [support("support-1", "empresaB")]),
    /P006_SOPORTE_TENANT/
  );
});

test("P0-06 rejects duplicate movement keys even if support differs", () => {
  assert.throws(
    () => verify([movement("mov-1", "support-1"), movement("mov-1", "support-2")], [support("support-1"), support("support-2")]),
    /P006_MOVIMIENTO_DUPLICADO/
  );
});
