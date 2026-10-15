"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularVentaExacta } = require("../../core/finanzas/services/calcularVentaExacta.service");

test("sale calculations preserve cents exactly", () => {
  const result = calcularVentaExacta({
    cantidad: "3",
    precioUnitarioCOP: "0.10",
    costoUnitarioCOP: "0.03",
    totalCOP: "0.30"
  });
  assert.equal(result.totalMenor, "30");
  assert.equal(result.costoTotalMenor, "9");
  assert.equal(result.utilidadBrutaMenor, "21");
});

test("inconsistent sale totals are rejected", () => {
  assert.throws(() => calcularVentaExacta({
    cantidad: "2",
    precioUnitarioCOP: "100.00",
    costoUnitarioCOP: "50.00",
    totalCOP: "200.01"
  }), /VENTA_TOTAL_INCONSISTENTE/);
});
