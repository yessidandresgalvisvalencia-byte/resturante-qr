"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Entrega = require("../../models/GrukEntregaConsumidor");

test("per-consumer delivery has a unique event/consumer identity", () => {
  const indexes = Entrega.schema.indexes();
  assert.ok(indexes.some(([keys, options]) =>
    keys.eventId === 1 && keys.consumidor === 1 && options.unique === true));
});

test("per-consumer delivery rejects invalid states", () => {
  const doc = new Entrega({
    empresaId: new mongoose.Types.ObjectId(),
    eventId: new mongoose.Types.ObjectId(),
    consumidor: "CAJA_VENTA_V1",
    estado: "DESCONOCIDO"
  });
  const error = doc.validateSync();
  assert.ok(error?.errors?.estado);
});

test("per-consumer delivery defaults to pending without acknowledging other consumers", () => {
  const eventId = new mongoose.Types.ObjectId();
  const empresaId = new mongoose.Types.ObjectId();
  const caja = new Entrega({ eventId, empresaId, consumidor: "CAJA_VENTA_V1" });
  const facturacion = new Entrega({ eventId, empresaId, consumidor: "FACTURACION_VENTA_V1" });
  assert.equal(caja.estado, "PENDIENTE");
  assert.equal(facturacion.estado, "PENDIENTE");
  assert.notEqual(caja.consumidor, facturacion.consumidor);
});

test("delivery lookups have a tenant event consumer index", () => {
  const indexes = Entrega.schema.indexes();
  assert.ok(indexes.some(([keys]) =>
    keys.empresaId === 1 && keys.eventId === 1 && keys.consumidor === 1));
});
