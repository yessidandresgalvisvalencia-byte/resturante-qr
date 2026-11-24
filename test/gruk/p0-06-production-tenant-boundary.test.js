"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { mountP006MongoRoute } = require("../../core/finanzas/mountP006MongoRoute");

const collectionNames = {
  movements: "gruk_p006_movements",
  stock: "gruk_p006_stock",
  expected: "gruk_p006_expected"
};
function setup(expected) {
  const routes = [];
  const reads = [];
  const app = { get: (...args) => routes.push(args) };
  const mongoose = { connection: { db: {
    collection(name) {
      reads.push(name);
      if (name !== collectionNames.expected) throw new Error("unexpected collection access");
      return { findOne: async (filter, options) => {
        reads.push({ filter, options });
        return expected;
      } };
    }
  } } };
  assert.equal(mountP006MongoRoute(app, mongoose, { enabled: true, collectionNames }), true);
  return { handler: routes[0][2], reads };
}
function response() {
  return {
    code: null, body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
}
const req = () => ({
  auth: { usuarioId: "u1", empresaId: "e1", sedeId: "s1", rol: "DUEÑO" },
  params: { empresaId: "e1", sedeId: "s1" }
});
test("P0-06 denies other-tenant scope without any database read", async () => {
  const { handler, reads } = setup(null);
  const request = req();
  request.params.empresaId = "e2";
  const res = response();
  await handler(request, res);
  assert.equal(res.code, 403);
  assert.deepEqual(reads, []);
});
test("P0-06 denies non-owner role before database read", async () => {
  const { handler, reads } = setup(null);
  const request = req();
  request.auth.rol = "CAJERO";
  const res = response();
  await handler(request, res);
  assert.equal(res.code, 403);
  assert.deepEqual(reads, []);
});
test("P0-06 fails closed on expected balance from another tenant", async () => {
  const { handler, reads } = setup({ empresaId: "e2", sedeId: "s1", expectedCentavos: "100" });
  const res = response();
  await handler(req(), res);
  assert.equal(res.code, 503);
  assert.deepEqual(res.body, { error: "DISCREPANCY_UNAVAILABLE" });
  assert.equal(reads[0], collectionNames.expected);
  assert.deepEqual(reads[1].filter, { empresaId: "e1", sedeId: "s1" });
  assert.equal(reads.length, 2);
});
test("P0-06 fails closed when expected balance is absent", async () => {
  const { handler, reads } = setup(null);
  const res = response();
  await handler(req(), res);
  assert.equal(res.code, 503);
  assert.equal(reads.length, 2);
});
