"use strict";

// P0 #04: offline idempotency index contract. This test is deliberately
// database-free; concurrent writes still require a separate MongoDB integration test.
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Pedido = require("../../models/pedido");

test("offline idempotency index is unique and scoped by empresa and sede", () => {
  const matches = Pedido.schema.indexes().filter(([keys]) =>
    Object.prototype.hasOwnProperty.call(keys, "offlineEventId"));
  assert.equal(matches.length, 1, "one authoritative offline event index");
  const [keys, options] = matches[0];
  assert.deepEqual(keys, { empresaId: 1, sedeId: 1, offlineEventId: 1 });
  assert.equal(options.unique, true);
  assert.deepEqual(options.partialFilterExpression, {
    offlineEventId: { $type: "string" }
  });
});

test("offline order schema exposes explicit tenant and location identity", () => {
  assert.equal(Pedido.schema.path("empresaId").instance, "ObjectId");
  assert.equal(Pedido.schema.path("sedeId").instance, "String");
  assert.equal(Pedido.schema.path("offlineEventId").instance, "String");
});

test("legacy orders without offline event remain valid at schema level", () => {
  const order = new Pedido({
    empresaId: new mongoose.Types.ObjectId(),
    mesa: 1, producto: "Prueba", cantidad: 1,
    precioUnitario: 100, precio: 100
  });
  assert.equal(order.validateSync(), undefined);
  assert.equal(order.offlineEventId, undefined);
});

test("legacy order without tenant or offline identity remains schema-compatible", () => {
  const order = new Pedido({
    mesa: 2, producto: "Pedido legado", cantidad: 1,
    precioUnitario: 100, precio: 100
  });
  assert.equal(order.validateSync(), undefined);
  assert.equal(order.empresaId, null);
  assert.equal(order.sedeId, "");
  assert.equal(order.offlineEventId, undefined);
});
