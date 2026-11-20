"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { cents, quantityParts, saleAmounts } = require("../../core/finanzas/dineroExacto");

test("P0-07 rejects oversized money before decimal conversion", () => {
  assert.throws(() => cents("9".repeat(129)), /DINERO_RANGO/);
  assert.throws(() => cents("0." + "0".repeat(127)), /DINERO_RANGO/);
});
test("P0-07 rejects oversized quantities before decimal conversion", () => {
  assert.throws(() => quantityParts("9".repeat(129)), /DINERO_CANTIDAD_RANGO/);
  assert.throws(() => quantityParts("0." + "0".repeat(127)), /DINERO_CANTIDAD_RANGO/);
});
test("P0-07 retains exact cents and fractional quantities", () => {
  assert.equal(cents("12.30"), 1230n);
  assert.deepEqual(quantityParts("1.5"), { units: 15n, denominator: 10n });
  const sale = saleAmounts({ precioUnitario: "12.30", precio: "18.45", costoUnitario: "5.00", cantidad: "1.5" });
  assert.equal(sale.costoTotal, 7.5);
  assert.equal(sale.utilidadBruta, 10.95);
});
