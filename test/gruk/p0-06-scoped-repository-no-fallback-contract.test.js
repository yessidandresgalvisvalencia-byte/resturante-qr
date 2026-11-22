"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readScopedReconciliation } = require("../../core/finanzas/lecturaConciliacionAcotada");

const request = repository => ({ empresaId: "empresa-a", sedeId: "sede-1", repository });
const snapshot = () => ({
  empresaId: "empresa-a", sedeId: "sede-1", expectedCentavos: "0",
  movements: [], records: []
});

test("P0-06 never falls back to an unscoped repository reader after scoped failure", async () => {
  let unscopedCalls = 0;
  let scopedCalls = 0;
  const repository = {
    async readScopedSnapshot(scope) {
      scopedCalls++;
      assert.deepEqual(scope, { empresaId: "empresa-a", sedeId: "sede-1" });
      throw new Error("SCOPED_READ_FAILED");
    },
    async find() { unscopedCalls++; return snapshot(); },
    async findAll() { unscopedCalls++; return snapshot(); },
    async readAll() { unscopedCalls++; return snapshot(); }
  };
  await assert.rejects(readScopedReconciliation(request(repository)), /SCOPED_READ_FAILED/);
  assert.equal(scopedCalls, 1);
  assert.equal(unscopedCalls, 0);
});

test("P0-06 invalid tenant scope rejects before invoking repository", async () => {
  let calls = 0;
  const repository = { async readScopedSnapshot() { calls++; return snapshot(); } };
  await assert.rejects(readScopedReconciliation({
    empresaId: "../empresa-a", sedeId: "sede-1", repository
  }), /P006_SCOPE_INVALIDO/);
  assert.equal(calls, 0);
});

test("P0-06 does not invoke request identity getters", async () => {
  let getterCalls = 0;
  const input = { sedeId: "sede-1", repository: {
    async readScopedSnapshot() { throw new Error("SHOULD_NOT_READ"); }
  }};
  Object.defineProperty(input, "empresaId", {
    enumerable: true,
    get() { getterCalls++; return "empresa-a"; }
  });
  await assert.rejects(readScopedReconciliation(input), /P006_RESPONSE_INVALIDA_empresaId/);
  assert.equal(getterCalls, 0);
});

test("P0-06 rejects scoped envelope accessor without invoking it", async () => {
  let getterCalls = 0;
  const response = snapshot();
  Object.defineProperty(response, "movements", {
    get() { getterCalls++; return []; }
  });
  const repository = { async readScopedSnapshot() { return response; } };
  await assert.rejects(readScopedReconciliation(request(repository)), /P006_RESPONSE_INVALIDA_movements/);
  assert.equal(getterCalls, 0);
});
