"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { cents, quantityParts, saleAmounts } = require("../../core/finanzas/dineroExacto");

test("P0-07 bounds untrusted money strings before BigInt", () => {
  for (const input of ["9".repeat(129), "0." + "0".repeat(127), " ".repeat(2) + "9".repeat(129)]) {
    assert.throws(() => cents(input), /DINERO_RANGO/);
  }
  assert.throws(() => cents("1." + "0".repeat(127)), /DINERO_RANGO/);
});
test("P0-07 bounds quantity strings before BigInt", () => {
  for (const input of ["9".repeat(129), "0." + "0".repeat(127)]) {
    assert.throws(() => quantityParts(input), /DINERO_CANTIDAD_RANGO/);
  }
});
test("P0-07 retains exact arithmetic and precision validation", () => {
  assert.equal(cents("12.30"), 1230n);
  assert.equal(cents("0." + "0".repeat(126)), 0n);
  assert.equal(cents("0".repeat(128)), 0n);
  assert.deepEqual(quantityParts("0".repeat(127) + "1"), { units: 1n, denominator: 1n });
  assert.deepEqual(quantityParts("1.5"), { units: 15n, denominator: 10n });
  assert.throws(() => cents("1.001"), /DINERO_PRECISION/);
  assert.throws(() => quantityParts("1.0000001"), /DINERO_CANTIDAD_PRECISION/);
  const sale = saleAmounts({ precioUnitario: "12.30", precio: "18.45", costoUnitario: "5.00", cantidad: "1.5" });
  assert.equal(sale.costoTotal, 7.5);
  assert.equal(sale.utilidadBruta, 10.95);
});
