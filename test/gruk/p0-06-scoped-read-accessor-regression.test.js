"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readScopedReconciliation } = require("../../core/finanzas/lecturaConciliacionAcotada");

const scope = { empresaId: "empresa-a", sedeId: "sede-a" };
test("P0-06: rejects accessor request fields without executing getters", async () => {
  let called = 0;
  const request = { ...scope, repository: {} };
  Object.defineProperty(request, "empresaId", { enumerable: true, get() { called++; throw new Error("getter executed"); } });
  await assert.rejects(readScopedReconciliation(request), /P006_RESPONSE_INVALIDA_empresaId/);
  assert.equal(called, 0);
});
test("P0-06: rejects inherited repository reads without executing them", async () => {
  let called = 0;
  const repository = Object.create({ readScopedSnapshot() { called++; throw new Error("unsafe read"); } });
  await assert.rejects(readScopedReconciliation({ ...scope, repository }), /P006_REPOSITORY_INVALIDO/);
  assert.equal(called, 0);
});
test("P0-06: rejects repository accessor without invoking it", async () => {
  let called = 0;
  const repository = {};
  Object.defineProperty(repository, "readScopedSnapshot", { get() { called++; throw new Error("getter executed"); } });
  await assert.rejects(readScopedReconciliation({ ...scope, repository }), /P006_REPOSITORY_INVALIDO/);
  assert.equal(called, 0);
});
test("P0-06: valid own repository function is called with bound this and scoped IDs", async () => {
  const repository = { async readScopedSnapshot(ids) {
    assert.equal(this, repository);
    assert.deepEqual(ids, scope);
    return { ...scope, movements: [], expectedCentavos: "0", records: [] };
  } };
  const result = await readScopedReconciliation({ ...scope, repository });
  assert.equal(result.financial.balanced, true);
  assert.equal(result.empresaId, scope.empresaId);
});
