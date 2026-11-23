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
    principal: { id: "actor1" }, authorize: () => { authorized = true; return true; }, request
  }), /P006_PANEL_REQUEST_CAMPO_empresaId/);
  assert.equal(executed, false);
  assert.equal(authorized, false);
  assert.deepEqual(reads, []);
});

test("P0-06 rejects missing or accessor-backed actor identity before authorization or Mongo reads", async () => {
  for (const principal of [null, {}, { id: "" }, { id: " " }, { id: 42 }, { id: "bad actor" },
    Object.defineProperty({}, "id", { get() { throw new Error("UNSAFE_ACTOR_GETTER"); } })]) {
    const reads = [];
    let authorized = false;
    await assert.rejects(readAuthorizedDiscrepancyPanel({
      principal, authorize: () => { authorized = true; return true; }, request: fixture(reads)
    }), /P006_PANEL_(REQUEST|PRINCIPAL)/);
    assert.equal(authorized, false);
    assert.deepEqual(reads, []);
  }
});
test("P0-06 rejects malformed tenant scope before authorization or Mongo reads", async () => {
  for (const field of ["empresaId", "sedeId"]) {
    for (const value of [" ", "tenant with spaces", "x/other", "x".repeat(129)]) {
      const reads = [], request = fixture(reads);
      request[field] = value;
      let authorized = false;
      await assert.rejects(readAuthorizedDiscrepancyPanel({
        principal: { id: "actor1" }, authorize: () => { authorized = true; return true; }, request
      }), /P006_PANEL_SCOPE_INVALIDO/);
      assert.equal(authorized, false);
      assert.deepEqual(reads, []);
    }
  }
});

test("P0-06 authorization cannot switch tenant scope after grant", async () => {
  const reads = [], request = fixture(reads);
  const result = await readAuthorizedDiscrepancyPanel({
    principal: { id: "actor1" },
    authorize: async ({ empresaId, sedeId }) => {
      assert.equal(empresaId, "empresaA");
      assert.equal(sedeId, "sede1");
      request.empresaId = "empresaB";
      request.sedeId = "sede2";
      return true;
    },
    request
  });
  assert.equal(result.readOnly, true);
  assert.deepEqual(reads, [
    { empresaId: "empresaA", sedeId: "sede1" },
    { empresaId: "empresaA", sedeId: "sede1" }
  ]);
});

test("P0-06 rejects unrelated accessor fields before authorization or Mongo reads", async () => {
  const reads = [], request = fixture(reads);
  let executed = false, authorized = false;
  Object.defineProperty(request, "injected", {
    enumerable: true,
    get() { executed = true; throw new Error("GETTER_EXECUTED"); }
  });
  await assert.rejects(readAuthorizedDiscrepancyPanel({
    principal: { id: "actor1" },
    authorize: () => { authorized = true; return true; },
    request
  }), /P006_PANEL_REQUEST_ACCESSOR_INVALIDO/);
  assert.equal(executed, false);
  assert.equal(authorized, false);
  assert.deepEqual(reads, []);
});

test("P0-06 authorization receives immutable authenticated actor snapshot", async () => {
  const reads = [], principal = { id: "actor1", role: "admin" };
  const result = await readAuthorizedDiscrepancyPanel({
    principal,
    authorize: async context => {
      assert.deepEqual(context.principal, { id: "actor1" });
      assert.equal(Object.isFrozen(context.principal), true);
      principal.id = "actor2";
      principal.role = "guest";
      assert.equal(context.principal.id, "actor1");
      return true;
    },
    request: fixture(reads)
  });
  assert.equal(result.readOnly, true);
  assert.equal(reads.length, 2);
});
