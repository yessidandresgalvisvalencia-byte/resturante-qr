"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ROUTE, registerDiscrepancyRoute } = require("../../core/finanzas/rutaDiferenciasP006");

test("P0-06 registers an explicit GET endpoint with injected trusted dependencies", () => {
  const routes = [];
  const router = { get(path, handler) { routes.push({ path, handler }); } };
  const deps = { getPrincipal: async () => ({ id: "actor1" }),
    authorize: async () => false, getCollections: async () => { throw Error("must not read"); } };
  assert.equal(registerDiscrepancyRoute(router, deps), router);
  assert.equal(routes.length, 1);
  assert.equal(routes[0].path, ROUTE);
  assert.equal(typeof routes[0].handler, "function");
});

test("P0-06 refuses registration without authentication, authorization and collections", () => {
  const routes = [], router = { get(...args) { routes.push(args); } };
  assert.throws(() => registerDiscrepancyRoute(router, {}), /DEPENDENCIES_INVALID/);
  assert.throws(() => registerDiscrepancyRoute(router, {
    getPrincipal: async () => ({}), authorize: async () => true
  }), /DEPENDENCIES_INVALID/);
  assert.throws(() => registerDiscrepancyRoute(null, {}), /ROUTER_INVALID/);
  assert.equal(routes.length, 0);
});

test("P0-06 registration never executes accessor dependencies", () => {
  let invoked = 0;
  const deps = Object.defineProperty({
    authorize: async () => true, getCollections: async () => ({})
  }, "getPrincipal", { get() { invoked++; throw Error("unsafe"); } });
  assert.throws(() => registerDiscrepancyRoute({ get() {} }, deps), /DEPENDENCIES_INVALID/);
  assert.equal(invoked, 0);
});
