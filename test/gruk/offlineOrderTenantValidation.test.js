"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Pedido = require("../../models/pedido");

const base = () => ({ mesa: 1, producto: "Producto", precio: 1000, precioUnitario: 1000 });
const empresaId = new mongoose.Types.ObjectId();

async function validate(values) {
  return new Pedido({ ...base(), ...values }).validate();
}

test("offline retry requires explicit company and nonblank site", async () => {
  await assert.rejects(validate({ offlineEventId: "evt-1", sedeId: "s1" }), /empresaId/);
  await assert.rejects(validate({ offlineEventId: "evt-1", empresaId }), /sedeId/);
  await assert.rejects(validate({ offlineEventId: "evt-1", empresaId, sedeId: "   " }), /sedeId/);
});

test("offline retry rejects empty event identity", async () => {
  await assert.rejects(validate({ offlineEventId: "", empresaId, sedeId: "s1" }), /offlineEventId/);
  await assert.rejects(validate({ offlineEventId: "   ", empresaId, sedeId: "s1" }), /offlineEventId/);
});

test("complete offline retry identity and legacy orders validate", async () => {
  await validate({ offlineEventId: "evt-1", empresaId, sedeId: "s1" });
  await validate({});
});

test("offline retry rejects invalid tenant identifiers and structured event keys", async () => {
  await assert.rejects(validate({ offlineEventId: "evt-1", empresaId: "not-an-object-id", sedeId: "s1" }), /empresaId/);
  await assert.rejects(validate({ offlineEventId: ["evt-1"], empresaId, sedeId: "s1" }), /offlineEventId/);
  await assert.rejects(validate({ offlineEventId: { $ne: null }, empresaId, sedeId: "s1" }), /offlineEventId/);
});

test("legacy orders without an offline event key retain compatibility", async () => {
  await validate({ offlineEventId: null, empresaId: null, sedeId: "" });
  await validate({ offlineEventId: undefined, empresaId: null, sedeId: "" });
});

// Distinct whitespace variants must not create parallel retry identities.
test("offline retry rejects noncanonical whitespace in tenant and event keys", async () => {
  await assert.rejects(validate({ offlineEventId: " evt-1", empresaId, sedeId: "s1" }), /offlineEventId/);
  await assert.rejects(validate({ offlineEventId: "evt-1 ", empresaId, sedeId: "s1" }), /offlineEventId/);
  await assert.rejects(validate({ offlineEventId: "evt-1", empresaId, sedeId: " s1" }), /sedeId/);
  await assert.rejects(validate({ offlineEventId: "evt-1", empresaId, sedeId: "s1 " }), /sedeId/);
});
