"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { copToMinor, minorToCop } = require("../../core/finanzas/services/copMinorUnits.service");

test("COP conversion is exact and round-trips cent values", () => {
  assert.equal(copToMinor("52000"), "5200000");
  assert.equal(copToMinor("0.01"), "1");
  assert.equal(copToMinor("0.10"), "10");
  assert.equal(minorToCop("5200000"), "52000.00");
  assert.equal(minorToCop(copToMinor("123456789.99")), "123456789.99");
});

test("COP conversion rejects floating point and fractional cents", () => {
  for (const invalid of [0.1, NaN, "-1", "01", "1.001", "1e3", "1,00", " 1"]) {
    assert.throws(() => copToMinor(invalid), /COP_DECIMAL_INVALIDO/);
  }
  assert.throws(() => minorToCop("1.5"), /COP_MENORES_INVALIDOS/);
  assert.throws(() => copToMinor("9".repeat(25)), /COP_FUERA_DE_RANGO/);
});
