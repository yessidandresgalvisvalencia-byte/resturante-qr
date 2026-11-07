"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Pedido = require("../../models/pedido");

// P0 #04/#05: guard the existing offline retry key against accidental
// removal or loss of tenant/sede scoping. This is a schema regression test,
// NOT a concurrency, persistence, or end-to-end certification.
test("offline order retry index is unique and scoped to company and site", () => {
  const matches = Pedido.schema.indexes().filter(([keys]) =>
    Object.hasOwn(keys, "offlineEventId")
  );
  assert.equal(matches.length, 1, "exactly one offline retry index expected");
  const [keys, options] = matches[0];
  assert.deepEqual(keys, { empresaId: 1, sedeId: 1, offlineEventId: 1 });
  assert.equal(options.unique, true);
  assert.deepEqual(options.partialFilterExpression, {
    offlineEventId: { $type: "string" }
  });
});

test("offline event identity remains optional for legacy orders", () => {
  const path = Pedido.schema.path("offlineEventId");
  assert.ok(path);
  assert.equal(path.isRequired, false);
  assert.equal(path.defaultValue, undefined);
});

test("company and site identity remain explicit order fields", () => {
  assert.ok(Pedido.schema.path("empresaId"));
  assert.ok(Pedido.schema.path("sedeId"));
  assert.equal(Pedido.schema.path("empresaId").options.index, true);
});
