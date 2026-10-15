"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validarPedidosIntento } = require("../../services/gruk/validarPedidosIntento");

const uno = "507f1f77bcf86cd799439011";
const dos = "507f191e810c19729de860ea";

test("GRUK: permite una lista de pedidos únicos", () => {
  assert.deepEqual(validarPedidosIntento([uno, dos]), [uno, dos]);
});
test("GRUK: rechaza lista vacía o sin pedidos", () => {
  for (const value of [[], null, undefined, "no-es-lista"]) {
    assert.throws(() => validarPedidosIntento(value), /PEDIDOS_DEL_INTENTO_INVALIDOS/);
  }
});
test("GRUK: rechaza ids de pedido repetidos", () => {
  assert.throws(() => validarPedidosIntento([uno, uno]), /PEDIDOS_DEL_INTENTO_INVALIDOS/);
  assert.throws(() => validarPedidosIntento([uno, uno.toUpperCase()]), /PEDIDOS_DEL_INTENTO_INVALIDOS/);
});
test("GRUK: rechaza ids inválidos", () => {
  for (const id of [null, undefined, "", "xyz", 3, {}, "507f1f77bcf86cd79943901Z"]) {
    assert.throws(() => validarPedidosIntento([id]), /PEDIDOS_DEL_INTENTO_INVALIDOS/);
  }
});
