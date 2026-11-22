"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyMovementEvidence } = require("../../core/finanzas/verificacionSoportesP006");

const empresaId = "empresa1";
const sedeId = "sede1";
const movement = (idempotencyKey, soporteId = null) => ({ empresaId, sedeId, idempotencyKey, soporteId });
const evidence = (soporteId) => ({ empresaId, sedeId, soporteId });

test("P0-06 rejects duplicate movement idempotency keys even when evidence differs", () => {
  assert.throws(() => verifyMovementEvidence({
    empresaId, sedeId,
    movements: [movement("tx1", "doc1"), movement("tx1", "doc2")],
    evidence: [evidence("doc1"), evidence("doc2")]
  }), /P006_MOVIMIENTO_DUPLICADO/);
});

test("P0-06 rejects repeated unsupported movements instead of silently deduplicating", () => {
  assert.throws(() => verifyMovementEvidence({
    empresaId, sedeId, movements: [movement("tx1"), movement("tx1")], evidence: []
  }), /P006_MOVIMIENTO_DUPLICADO/);
});

test("P0-06 preserves deterministic reporting for distinct movement keys", () => {
  const result = verifyMovementEvidence({
    empresaId, sedeId,
    movements: [movement("tx2"), movement("tx1", "doc1")],
    evidence: [evidence("doc1")]
  });
  assert.deepEqual(result.unsupportedMovementKeys, ["tx2"]);
  assert.equal(result.unsupportedCount, 1);
});
