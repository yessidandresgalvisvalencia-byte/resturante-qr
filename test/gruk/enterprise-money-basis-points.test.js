"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { applyBasisPoints } = require("../../core/enterprise/moneyMinorUnits");

test("basis-point rates use exact integer arithmetic beyond safe Number range", () => {
  assert.equal(applyBasisPoints("9007199254740993", "10000"), "9007199254740993");
  assert.equal(applyBasisPoints("10000", "1900"), "1900");
  assert.equal(applyBasisPoints("10000", "0"), "0");
});
test("rounding ties away from zero is symmetric for refunds", () => {
  assert.equal(applyBasisPoints("1", "5000"), "1");
  assert.equal(applyBasisPoints("-1", "5000"), "-1");
  assert.equal(applyBasisPoints("1", "4999"), "0");
  assert.equal(applyBasisPoints("-1", "4999"), "0");
});
test("invalid rates and output overflow fail closed", () => {
  for (const rate of ["-1", "01", "1.2", "1e2", "", 100, null, "1000000"]) {
    assert.throws(() => applyBasisPoints("100", rate));
  }
  assert.throws(() => applyBasisPoints("9".repeat(30), "999999"), RangeError);
});
