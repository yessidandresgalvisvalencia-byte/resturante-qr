"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseMinorUnits, formatMinorUnits } = require("../../core/finance/exactMoney");

test("money round trips exactly beyond Number.MAX_SAFE_INTEGER", () => {
  const amount = "9007199254740993.01";
  assert.equal(formatMinorUnits(parseMinorUnits(amount)), amount);
});
test("money preserves signs and zero", () => {
  assert.equal(parseMinorUnits("-0.01"), -1n);
  assert.equal(formatMinorUnits(-1n), "-0.01");
  assert.equal(formatMinorUnits(0n), "0.00");
  assert.equal(parseMinorUnits("12", 0), 12n);
  assert.equal(formatMinorUnits(12n, 0), "12");
});
test("money rejects floats, exponent notation, separators and silent rounding", () => {
  for (const amount of [1.2, "1e3", "1,000.00", "1.234", " 1.00", "+1.00", "01.00", "NaN", "Infinity"]) {
    assert.throws(() => parseMinorUnits(amount));
  }
});
test("money supports explicit currency scales without rounding", () => {
  assert.equal(parseMinorUnits("1200", 0), 1200n);
  assert.equal(parseMinorUnits("1.234", 3), 1234n);
  assert.throws(() => parseMinorUnits("1.1", -1));
  assert.throws(() => formatMinorUnits(1, 2));
});

test("money round trips at supported precision boundaries without Number coercion", () => {
  const whole = "9".repeat(38);
  for (const scale of [0, 2, 9]) {
    const decimal = scale ? whole + "." + "7".repeat(scale) : whole;
    const units = parseMinorUnits(decimal, scale);
    assert.equal(typeof units, "bigint");
    assert.equal(formatMinorUnits(units, scale), decimal);
    assert.equal(formatMinorUnits(-units, scale), "-" + decimal);
  }
  assert.throws(() => parseMinorUnits("9".repeat(39)), RangeError);
});

test("money rejects noncanonical or unsupported inputs at trust boundary", () => {
  for (const value of ["", ".", "-.", "- 1", "1.", "0x10", "1_000", "1\\n", "1.0000000000", {}, null, 1n]) {
    assert.throws(() => parseMinorUnits(value));
  }
  for (const scale of [NaN, Infinity, 1.5, -1, 10, "2"]) {
    assert.throws(() => parseMinorUnits("1", scale), TypeError);
    assert.throws(() => formatMinorUnits(1n, scale), TypeError);
  }
});
