"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createDiscrepancyHttpHandler } = require("../../core/finanzas/httpDiferenciasP006");

function response() {
  return { code: null, body: null, status(n) { this.code = n; return this; },
    json(v) { this.body = v; return this; } };
}
function collection(rows, reads) {
  return { find(filter) {
    reads.push(filter);
    return { limit(n) { return { async toArray() { return rows.slice(0, n); } }; } };
  } };
}
function deps(reads, decisions = true) {
  const calls = { auth: 0, collections: 0 };
  return {
    calls,
    getPrincipal: async () => ({ id: "actor1" }),
    authorize: async context => { calls.auth++; assert.equal(context.empresaId, "empresaA"); return decisions; },
    getCollections: async () => {
      calls.collections++;
      return { expectedCentavos: "5",
        movementsCollection: collection([{ empresaId: "empresaA", sedeId: "sede1", idempotencyKey: "m1", centavos: "5" }], reads),
        stockCollection: collection([], reads) };
    }
  };
}
const request = { params: { empresaId: "empresaA", sedeId: "sede1" },
  body: { principal: { id: "attacker" }, expectedCentavos: "999" } };

test("P0-06 HTTP adapter returns scoped projection without trusting request body", async () => {
  const reads = [], d = deps(reads), res = response();
  await createDiscrepancyHttpHandler(d)(request, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.cashMismatch, false);
  assert.equal(res.body.readOnly, true);
  assert.equal(d.calls.collections, 1);
  assert.deepEqual(reads, [
    { empresaId: "empresaA", sedeId: "sede1" },
    { empresaId: "empresaA", sedeId: "sede1" }
  ]);
});
test("P0-06 HTTP adapter rejects unauthorized access without collection lookup", async () => {
  const reads = [], d = deps(reads, false), res = response();
  await createDiscrepancyHttpHandler(d)(request, res);
  assert.equal(res.code, 403);
  assert.equal(d.calls.collections, 0);
  assert.deepEqual(reads, []);
});
test("P0-06 HTTP adapter rejects missing identity and invalid scope", async () => {
  const reads = [], d = deps(reads);
  d.getPrincipal = async () => null;
  const handler = createDiscrepancyHttpHandler(d), res = response();
  await handler(request, res);
  assert.equal(res.code, 401);
  assert.equal(d.calls.auth, 0);
  const d2 = deps(reads), res2 = response();
  await createDiscrepancyHttpHandler(d2)({ params: { empresaId: "../other", sedeId: "sede1" } }, res2);
  assert.equal(res2.code, 400);
  assert.equal(d2.calls.collections, 0);
});
test("P0-06 HTTP adapter fails closed on dependency errors", async () => {
  const reads = [], d = deps(reads);
  d.getCollections = async () => { throw new Error("SECRET_DB_ERROR"); };
  const res = response();
  await createDiscrepancyHttpHandler(d)(request, res);
  assert.equal(res.code, 503);
  assert.deepEqual(res.body, { error: "DISCREPANCY_UNAVAILABLE" });
  assert.deepEqual(reads, []);
});

test("P0-06 HTTP adapter snapshots principal before asynchronous authorization", async () => {
  const reads = [], d = deps(reads), res = response();
  const principal = { id: "actor1" };
  d.getPrincipal = async () => principal;
  d.authorize = async context => {
    assert.equal(context.principal.id, "actor1");
    principal.id = "attacker";
    return true;
  };
  await createDiscrepancyHttpHandler(d)(request, res);
  assert.equal(res.code, 200);
  assert.equal(reads.length, 2);
});

test("P0-06 HTTP adapter rejects accessor-backed identity without executing getter", async () => {
  const reads = [], d = deps(reads), res = response();
  let invoked = 0;
  d.getPrincipal = async () => Object.defineProperty({}, "id", {
    get() { invoked++; throw new Error("untrusted getter"); }
  });
  await createDiscrepancyHttpHandler(d)(request, res);
  assert.equal(res.code, 401);
  assert.equal(invoked, 0);
  assert.equal(d.calls.auth, 0);
  assert.equal(d.calls.collections, 0);
  assert.deepEqual(reads, []);
});

test("P0-06 HTTP adapter rejects accessor-backed route params without executing getter", async () => {
  const reads = [], d = deps(reads), res = response();
  let invoked = 0;
  const params = Object.defineProperty({ sedeId: "sede1" }, "empresaId", {
    get() { invoked++; throw new Error("untrusted getter"); }
  });
  await createDiscrepancyHttpHandler(d)({ params }, res);
  assert.equal(res.code, 400);
  assert.equal(invoked, 0);
  assert.equal(d.calls.auth, 0);
  assert.equal(d.calls.collections, 0);
  assert.deepEqual(reads, []);
});
