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

test("sale multiplication rejects amounts exceeding ledger bounds", () => {
  assert.throws(() => calcularVentaExacta({
    cantidad: "1000000000", precioUnitarioCOP: "9999999999999999999999.99",
    costoUnitarioCOP: "0", totalCOP: "0"
  }), /VENTA_TOTAL_FUERA_DE_RANGO/);
  assert.throws(() => calcularVentaExacta({
    cantidad: "2", precioUnitarioCOP: "0",
    costoUnitarioCOP: "9999999999999999999999.99", totalCOP: "0"
  }), /VENTA_COSTO_FUERA_DE_RANGO/);
});
