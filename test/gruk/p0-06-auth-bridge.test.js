"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createP006RequestHandler, mountAuthenticatedP006Route } = require("../../core/finanzas/authBridgeP006");
function response() {
  return { code: 0, body: null, status(n) { this.code = n; return this; },
    json(body) { this.body = body; return this; } };
}
const params = { empresaId: "tenant1", sedeId: "site1" };
const auth = { usuarioId: "actor1", empresaId: "tenant1", sedeId: "site1", rol: "auditor" };
test("P0-06 JWT bridge rejects cross-tenant requests before permissions or Mongo", async () => {
  let calls = 0;
  const handler = createP006RequestHandler({
    authorizeRole: async () => { calls++; return true; },
    getCollections: async () => { calls++; throw Error("should not run"); }
  });
  const res = response();
  await handler({ auth, params: { ...params, empresaId: "other" } }, res);
  assert.equal(res.code, 403);
  assert.equal(calls, 0);
});
test("P0-06 JWT bridge requires verified authentication context", async () => {
  const handler = createP006RequestHandler({
    authorizeRole: async () => true, getCollections: async () => ({})
  });
  const res = response();
  await handler({ params, body: { auth } }, res);
  assert.equal(res.code, 401);
});
test("P0-06 JWT bridge denies when role evaluator does not explicitly grant", async () => {
  let collections = 0;
  const handler = createP006RequestHandler({
    authorizeRole: async scope => {
      assert.equal(scope.actorId, "actor1");
      assert.equal(scope.action, "gruk.p006.discrepancies.read");
      return false;
    },
    getCollections: async () => { collections++; return {}; }
  });
  const res = response();
  await handler({ auth, params }, res);
  assert.equal(res.code, 403);
  assert.equal(collections, 0);
});
test("P0-06 JWT bridge does not evaluate accessors on untrusted auth", async () => {
  let invoked = false;
  const evil = Object.defineProperty({}, "usuarioId", { get() { invoked = true; throw Error("getter"); } });
  const handler = createP006RequestHandler({
    authorizeRole: async () => true, getCollections: async () => ({})
  });
  const res = response();
  await handler({ auth: evil, params }, res);
  assert.equal(res.code, 401);
  assert.equal(invoked, false);
});

test("P0-06 mount wires JWT middleware before tenant-scoped handler", async () => {
  let registered;
  const router = { get(...args) { registered = args; } };
  const jwt = (req, res, next) => { req.auth = { ...auth }; next(); };
  mountAuthenticatedP006Route(router, jwt, {
    authorizeRole: async () => false,
    getCollections: async () => { throw Error("must not query unauthorized tenant"); }
  });
  assert.equal(registered[0], "/api/gruk/empresas/:empresaId/sedes/:sedeId/conciliacion/diferencias");
  assert.equal(registered[1], jwt);
  const req = { params };
  registered[1](req, response(), () => {});
  const res = response();
  await registered[2](req, res);
  assert.equal(res.code, 403);
});
test("P0-06 mount fails closed if JWT middleware is missing", () => {
  let mounted = false;
  const router = { get() { mounted = true; } };
  assert.throws(() => mountAuthenticatedP006Route(router, undefined, {
    authorizeRole: async () => true, getCollections: async () => ({})
  }), /P006_AUTH_ROUTE_INVALID/);
  assert.equal(mounted, false);
});
