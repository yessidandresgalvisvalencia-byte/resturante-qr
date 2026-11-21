"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { centavosToDecimal, decimalToCentavos } = require("../../core/finanzas/serializacionCentavos");

test("P0-07 decimal serialization preserves centavos without binary floating point", () => {
  for (const value of [0n, 1n, -1n, 10n, 100n, 123456789n, -123456789n,
    BigInt(Number.MAX_SAFE_INTEGER), -BigInt(Number.MAX_SAFE_INTEGER)]) {
    const encoded = centavosToDecimal(value);
    assert.match(encoded, /^-?\d+\.\d{2}$/);
    assert.equal(decimalToCentavos(encoded), value);
  }
  assert.equal(centavosToDecimal(-1n), "-0.01");
  assert.equal(centavosToDecimal(101n), "1.01");
  assert.equal(decimalToCentavos("0.10"), 10n);
});

test("P0-07 serialization rejects unsafe types and out-of-range centavos", () => {
  for (const input of [1, "1", null, undefined, {}, true]) {
    assert.throws(() => centavosToDecimal(input), /DINERO_INVALIDO/);
  }
  for (const input of [0.1, 1, null, undefined, {}, true]) {
    assert.throws(() => decimalToCentavos(input), /DINERO_INVALIDO/);
  }
  assert.throws(() => centavosToDecimal(BigInt(Number.MAX_SAFE_INTEGER) + 1n), /DINERO_RANGO/);
  assert.throws(() => decimalToCentavos("1.001"), /DINERO_PRECISION/);
  assert.throws(() => decimalToCentavos("9".repeat(129)), /DINERO_RANGO/);
});
