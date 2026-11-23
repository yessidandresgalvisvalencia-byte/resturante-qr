"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readAuthorizedDiscrepancyPanel } = require("../../core/finanzas/panelDiferenciasAutorizadoP006");

function collection(rows, reads) {
  return { find(filter) {
    reads.push(filter);
    return { limit(n) { return { async toArray() { return rows.slice(0, n); } }; } };
  } };
}
function fixture(reads) {
  return {
    empresaId: "empresaA", sedeId: "sede1", expectedCentavos: "5",
    movementsCollection: collection([{ empresaId: "empresaA", sedeId: "sede1", idempotencyKey: "m1", centavos: "5" }], reads),
    stockCollection: collection([], reads)
  };
}
test("P0-06 authorized panel reads only after explicit tenant and branch grant", async () => {
  const reads = [], calls = [];
  const result = await readAuthorizedDiscrepancyPanel({
    principal: Object.freeze({ id: "actor1" }),
    authorize: async context => { calls.push(context); return true; },
    request: fixture(reads)
  });
  assert.equal(result.cashMismatch, false);
  assert.equal(result.readOnly, true);
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(calls.map(c => [c.empresaId, c.sedeId, c.action]), [["empresaA", "sede1", "gruk.p006.discrepancies.read"]]);
  assert.deepEqual(reads, [
    { empresaId: "empresaA", sedeId: "sede1" },
    { empresaId: "empresaA", sedeId: "sede1" }
  ]);
});
test("P0-06 denied and non-boolean authorization cannot access collections", async () => {
  for (const decision of [false, undefined, "true", 1]) {
    const reads = [];
    await assert.rejects(readAuthorizedDiscrepancyPanel({
      principal: { id: "actor2" }, authorize: async () => decision, request: fixture(reads)
    }), /P006_PANEL_FORBIDDEN/);
    assert.deepEqual(reads, []);
  }
});
test("P0-06 authorization errors fail closed before database access", async () => {
  const reads = [];
  await assert.rejects(readAuthorizedDiscrepancyPanel({
    principal: { id: "actor2" }, authorize: async () => { throw new Error("AUTH_UNAVAILABLE"); }, request: fixture(reads)
  }), /AUTH_UNAVAILABLE/);
  assert.deepEqual(reads, []);
});
test("P0-06 accessor-backed scope rejected before authorization and reads", async () => {
  const reads = [], request = fixture(reads);
  let executed = false, authorized = false;
  Object.defineProperty(request, "empresaId", { get() { executed = true; throw new Error("UNSAFE_GETTER"); } });
  await assert.rejects(readAuthorizedDiscrepancyPanel({
    principal: {}, authorize: () => { authorized = true; return true; }, request
  }), /P006_PANEL_REQUEST_CAMPO_empresaId/);
  assert.equal(executed, false);
  assert.equal(authorized, false);
  assert.deepEqual(reads, []);
});
