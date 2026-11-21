"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const money = require("../../core/enterprise/moneyMinorUnits");

test("adds and subtracts integer minor units exactly above Number.MAX_SAFE_INTEGER", () => {
  assert.equal(money.addMinorUnits("9007199254740993", "7"), "9007199254741000");
  assert.equal(money.subtractMinorUnits("2", "5"), "-3");
  assert.equal(money.sumMinorUnits(["1", "-2", "3"]), "2");
});
test("rejects floats, exponential notation, unsafe numeric input and noncanonical forms", () => {
  for (const bad of ["1.1", "1e3", "01", "-0", " 1", "+1", "", 1, 1.2, null]) {
    assert.throws(() => money.parseMinorUnits(bad));
  }
});
test("does not mutate source entries and rejects non-arrays", () => {
  const entries = ["100", "-25"];
  assert.equal(money.sumMinorUnits(entries), "75");
  assert.deepEqual(entries, ["100", "-25"]);
  assert.throws(() => money.sumMinorUnits("100"));
});
