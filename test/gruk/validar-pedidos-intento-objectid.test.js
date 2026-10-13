"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validarPedidosIntento } = require("../../services/gruk/validarPedidosIntento");

const id = "507f1f77bcf86cd799439011";

test("GRUK: validador admite ObjectId de Mongoose serializable", () => {
  const fakeObjectId = { toString() { return id; } };
  assert.deepEqual(validarPedidosIntento([fakeObjectId]), [id]);
});

test("GRUK: ObjectId mixto y string de mismo pedido se reconoce duplicado", () => {
  const fakeObjectId = { toString() { return id; } };
  assert.throws(() => validarPedidosIntento([fakeObjectId, id]), /PEDIDOS_DEL_INTENTO_INVALIDOS/);
});

test("GRUK: el validador no muta la lista original", () => {
  const original = [id.toUpperCase()];
  const copy = [...original];
  assert.deepEqual(validarPedidosIntento(original), [id]);
  assert.deepEqual(original, copy);
});
