"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const money = require("../../core/enterprise/moneyMinorUnits");

const max = "9".repeat(30);
test("rejects results exceeding the 30-digit minor-unit persistence contract", () => {
  assert.throws(() => money.addMinorUnits(max, "1"), RangeError);
  assert.throws(() => money.subtractMinorUnits("-" + max, "1"), RangeError);
  assert.throws(() => money.sumMinorUnits([max, "1"]), RangeError);
});
test("accepts boundary results and cancellation without floating point", () => {
  assert.equal(money.addMinorUnits(max, "0"), max);
  assert.equal(money.sumMinorUnits([max, "-" + max]), "0");
  assert.equal(money.subtractMinorUnits("0", "1"), "-1");
});
