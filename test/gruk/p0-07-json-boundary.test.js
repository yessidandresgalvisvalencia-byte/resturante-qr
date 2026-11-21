"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { centavosToDecimal, decimalToCentavos } = require("../../core/finanzas/serializacionCentavos");

test("P0-07 JSON persistence boundary retains exact signed centavos", () => {
  const inputs = [0n, 1n, -1n, 99n, -99n, 100n, -100n, 101n, -101n,
    123456789012345n, -123456789012345n,
    BigInt(Number.MAX_SAFE_INTEGER), -BigInt(Number.MAX_SAFE_INTEGER)];
  for (const original of inputs) {
    const json = JSON.stringify({ empresaId: "empresa-a", importe: centavosToDecimal(original) });
    const parsed = JSON.parse(json);
    assert.equal(parsed.empresaId, "empresa-a");
    assert.equal(typeof parsed.importe, "string");
    assert.equal(decimalToCentavos(parsed.importe), original);
  }
});

test("P0-07 persistence boundary refuses untrusted numeric and malformed monetary input", () => {
  const invalid = ["", " ", "NaN", "Infinity", "1e3", "0x10", "1,00",
    "1.001", "0.0000001", "--1", "1.2.3", "9".repeat(129)];
  for (const value of invalid) {
    assert.throws(() => decimalToCentavos(value), /DINERO_(INVALIDO|PRECISION|RANGO)/, value);
  }
  const decodedNumber = JSON.parse('{"importe":0.1}').importe;
  assert.throws(() => decimalToCentavos(decodedNumber), /DINERO_INVALIDO/);
  assert.throws(() => centavosToDecimal(0), /DINERO_INVALIDO/);
});
