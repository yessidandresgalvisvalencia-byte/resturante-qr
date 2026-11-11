"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Pedido = require("../../models/pedido");

// Plan Maestro P0 #04: an offline retry must never acquire a key under a
// missing tenant or location. These tests exercise async Mongoose middleware,
// not validateSync(), which does not execute pre("validate") hooks.
function order(fields = {}) {
  return new Pedido({
    mesa: 1, producto: "Contrato offline", cantidad: 1,
    precioUnitario: 100, precio: 100, ...fields
  });
}

test("P0-04: rejects offline event without empresaId", async () => {
  const doc = order({ sedeId: "sede-a", offlineEventId: "evt-1" });
  await assert.rejects(doc.validate(), err =>
    Boolean(err.errors?.empresaId));
});

test("P0-04: rejects offline event without nonempty sedeId", async () => {
  const doc = order({
    empresaId: new mongoose.Types.ObjectId(), offlineEventId: "evt-2"
  });
  await assert.rejects(doc.validate(), err =>
    Boolean(err.errors?.sedeId));
});

test("P0-04: rejects blank or padded offline event keys", async () => {
  for (const offlineEventId of ["", " ", " evt-3 "]) {
    const doc = order({
      empresaId: new mongoose.Types.ObjectId(),
      sedeId: "sede-a", offlineEventId
    });
    await assert.rejects(doc.validate(), err =>
      Boolean(err.errors?.offlineEventId),
      "expected invalid offlineEventId: " + JSON.stringify(offlineEventId));
  }
});

test("P0-04: accepts a complete tenant-scoped offline event", async () => {
  const doc = order({
    empresaId: new mongoose.Types.ObjectId(),
    sedeId: "sede-a", offlineEventId: "evt-valid"
  });
  await doc.validate();
});

test("P0-04: legacy order without offlineEventId remains valid", async () => {
  await order().validate();
});
