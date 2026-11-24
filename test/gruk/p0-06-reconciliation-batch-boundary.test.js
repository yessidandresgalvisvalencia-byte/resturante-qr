"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileMovements } = require("../../core/finanzas/reconciliacionExacta");

const scope = (movements, expectedCentavos) => ({
  empresaId: "tenant-a", sedeId: "branch-a", movements, expectedCentavos
});
const entry = (idempotencyKey, centavos) => ({
  empresaId: "tenant-a", sedeId: "branch-a", idempotencyKey, centavos
});

test("P0-06 processes the full 10,000-entry bounded batch with exact cents and JSON-safe output", () => {
  const movements = Array.from({ length: 10000 }, (_, i) => entry("payment:" + i, "1"));
  const result = reconcileMovements(scope(movements, "10000"));
  assert.equal(result.balanced, true);
  assert.equal(result.actualCentavos, "10000");
  assert.equal(result.uniqueMovements, 10000);
  assert.deepEqual(result.duplicateKeys, []);
  assert.equal(JSON.parse(JSON.stringify(result)).actualCentavos, "10000");
  assert.equal(movements.length, 10000);
  assert.equal(movements[0].centavos, "1");
  assert.throws(() => reconcileMovements(scope([...movements, entry("payment:10000", "1")], "10001")), /MOVIMIENTOS_INVALIDOS/);
});

test("P0-06 returns immutable duplicate evidence without mutating the source movements", () => {
  const movements = [entry("same", "12"), entry("same", "12"), entry("other", "-2")];
  const original = JSON.stringify(movements);
  const result = reconcileMovements(scope(movements, "10"));
  assert.equal(result.balanced, true);
  assert.equal(result.uniqueMovements, 2);
  assert.deepEqual(result.duplicateKeys, ["same"]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.duplicateKeys), true);
  assert.throws(() => result.duplicateKeys.push("forged"), TypeError);
  assert.equal(JSON.stringify(movements), original);
});
