"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ROUTE, registerDiscrepancyRoute } = require("../../core/finanzas/rutaDiferenciasP006");

function response() {
  return { code: null, body: null, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}
function collection(rows, reads) {
  return { find(scope) {
    reads.push(scope);
    return { limit(n) { return { async toArray() { return rows.slice(0, n); } }; } };
  } };
}
function setup({ allowed = true, actor = "actor1" } = {}) {
  const routes = [], reads = [], events = [];
  const router = { get(path, handler) { routes.push({ path, handler }); } };
  registerDiscrepancyRoute(router, {
    getPrincipal: async () => { events.push("principal"); return actor ? { id: actor } : null; },
    authorize: async context => {
      events.push("authorize");
      assert.equal(context.empresaId, "empresaA");
      assert.equal(context.sedeId, "sede1");
      assert.equal(context.action, "gruk.p006.discrepancies.read");
      return allowed;
    },
    getCollections: async scope => {
      events.push("collections");
      assert.deepEqual(scope, { empresaId: "empresaA", sedeId: "sede1" });
      return {
        expectedCentavos: "5",
        movementsCollection: collection([
          { empresaId: "empresaA", sedeId: "sede1", idempotencyKey: "m1", centavos: "5" }
        ], reads),
        stockCollection: collection([], reads)
      };
    }
  });
  assert.equal(routes.length, 1);
  assert.equal(routes[0].path, ROUTE);
  return { handler: routes[0].handler, reads, events };
}
const req = () => ({ params: { empresaId: "empresaA", sedeId: "sede1" },
  body: { empresaId: "empresaB", principal: { id: "attacker" } } });

test("P0-06 registered route executes authenticated tenant-scoped read end-to-end through adapters", async () => {
  const { handler, reads, events } = setup();
  const res = response();
  await handler(req(), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.readOnly, true);
  assert.equal(res.body.cashMismatch, false);
  assert.deepEqual(reads, [
    { empresaId: "empresaA", sedeId: "sede1" },
    { empresaId: "empresaA", sedeId: "sede1" }
  ]);
  assert.deepEqual(events, ["principal", "authorize", "collections", "authorize"]);
});

test("P0-06 registered route refuses unauthorized request before collection acquisition", async () => {
  const { handler, reads, events } = setup({ allowed: false });
  const res = response();
  await handler(req(), res);
  assert.equal(res.code, 403);
  assert.deepEqual(res.body, { error: "FORBIDDEN" });
  assert.deepEqual(reads, []);
  assert.deepEqual(events, ["principal", "authorize"]);
});

test("P0-06 registered route refuses unauthenticated request without authorization or reads", async () => {
  const { handler, reads, events } = setup({ actor: null });
  const res = response();
  await handler(req(), res);
  assert.equal(res.code, 401);
  assert.deepEqual(res.body, { error: "UNAUTHENTICATED" });
  assert.deepEqual(reads, []);
  assert.deepEqual(events, ["principal"]);
});
