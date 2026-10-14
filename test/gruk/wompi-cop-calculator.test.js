"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { totalPedidoCopEnCentavos } = require("../../services/gruk/totalPedidoCopEnCentavos");

test("Cálculo COP compartido: produce centavos exactos", () => {
  assert.equal(totalPedidoCopEnCentavos([52000, 280000]), 33200000);
});
test("Cálculo COP compartido: rechaza precios fraccionarios o inseguros", () => {
  for (const precio of [0, -1, 100.5, NaN, Infinity, "52000", Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => totalPedidoCopEnCentavos([precio]));
  }
});
test("Cálculo COP compartido: evita desbordamiento de la suma", () => {
  const limite = Math.floor(Number.MAX_SAFE_INTEGER / 100);
  assert.throws(() => totalPedidoCopEnCentavos([limite, 1]), /MONTO_TOTAL_NO_REPRESENTABLE/);
  assert.throws(() => totalPedidoCopEnCentavos([]), /PEDIDOS_SIN_PRECIOS/);
});
