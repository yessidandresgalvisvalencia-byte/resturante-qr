"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearEventoVentaCompletada } = require("../../services/gruk/crearEventoVentaCompletada");

const maxPesos = Math.floor(Number.MAX_SAFE_INTEGER / 100);
function venta(total) {
  return {
    _id: "507f1f77bcf86cd799439011",
    empresaId: "507f191e810c19729de860ea",
    origenId: "507f1f77bcf86cd799439012",
    origen: "restaurante", estado: "pagada", metodoPago: "tarjeta",
    total, metadata: { restaurantId: "rest-test" }
  };
}
test("Contrato Outbox conserva monto COP convertible sin perder centavos", () => {
  const evt = crearEventoVentaCompletada(venta(maxPesos));
  assert.equal(evt.payload.total, maxPesos);
  assert.ok(Number.isSafeInteger(evt.payload.total * 100));
});
test("Contrato Outbox rechaza monto que produciría centavos no seguros", () => {
  assert.throws(() => crearEventoVentaCompletada(venta(maxPesos + 1)), /VENTA_OUTBOX_INVALIDA/);
});
test("Contrato Outbox rechaza montos fraccionarios y negativos", () => {
  for (const monto of [52000.5, -1, 0, NaN, Infinity]) {
    assert.throws(() => crearEventoVentaCompletada(venta(monto)), /VENTA_OUTBOX_INVALIDA/);
  }
});
