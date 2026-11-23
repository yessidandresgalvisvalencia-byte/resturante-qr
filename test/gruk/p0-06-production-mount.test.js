"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { mountP006MongoRoute } = require("../../core/finanzas/mountP006MongoRoute");

test("P0-06 stays disabled by default", () => {
  const routes = [];
  assert.equal(mountP006MongoRoute({ get: (...args) => routes.push(args) }, {}, {}), false);
  assert.equal(routes.length, 0);
});
test("P0-06 rejects missing or duplicated collection contracts", () => {
  const app = { get() { throw new Error("must not register"); } };
  assert.throws(() => mountP006MongoRoute(app, {}, { enabled: true }), /COLLECTION_NAMES_INVALID/);
  assert.throws(() => mountP006MongoRoute(app, {}, { enabled: true, collectionNames: {
    movements: "gruk_p006_same", stock: "gruk_p006_same", expected: "gruk_p006_expected"
  } }), /COLLECTION_NAMES_DUPLICATE/);
});
test("P0-06 registers JWT before tenant-scoped handler and refuses unauthenticated reads", async () => {
  const routes = [];
  const app = { get: (...args) => routes.push(args) };
  const mongoose = { connection: { db: { collection() { throw new Error("unauthorized DB read"); } } } };
  assert.equal(mountP006MongoRoute(app, mongoose, { enabled: true, collectionNames: {
    movements: "gruk_p006_movements", stock: "gruk_p006_stock", expected: "gruk_p006_expected"
  } }), true);
  assert.equal(routes.length, 1);
  assert.match(routes[0][0], /conciliacion\/diferencias$/);
  assert.equal(typeof routes[0][1], "function");
  assert.equal(typeof routes[0][2], "function");
  let status, payload;
  const res = { status(n) { status = n; return this; }, json(x) { payload = x; return this; } };
  await routes[0][2]({ params: { empresaId: "e1", sedeId: "s1" } }, res);
  assert.equal(status, 401);
  assert.equal(payload.error, "UNAUTHENTICATED");
});
