"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { addMinorUnits, subtractMinorUnits, sumMinorUnits, parseMinorUnits } = require("../../core/enterprise/moneyMinorUnits");

test("exact arithmetic preserves identities and ordering for deterministic large values", () => {
  const values = ["0", "1", "-1", "9007199254740993", "-9007199254740993", "99999999999999999999999999999"];
  for (const a of values) {
    assert.equal(addMinorUnits(a, "0"), a);
    assert.equal(subtractMinorUnits(a, a), "0");
    if (a !== "0" && !a.startsWith("-")) assert.equal(addMinorUnits(a, "-" + a), "0");
  }
  for (const a of values) {
    for (const b of values) {
      const expected = (BigInt(a) + BigInt(b)).toString();
      if (expected.replace(/^-/, "").length <= 30) {
        assert.equal(addMinorUnits(a, b), expected);
        assert.equal(addMinorUnits(b, a), expected);
      } else {
        assert.throws(() => addMinorUnits(a, b), RangeError);
      }
    }
  }
});

test("empty sum, canonical input boundaries and no numeric coercion", () => {
  assert.equal(sumMinorUnits([]), "0");
  assert.equal(parseMinorUnits("0"), 0n);
  assert.equal(parseMinorUnits("-" + "9".repeat(30)), -BigInt("9".repeat(30)));
  for (const bad of ["-00", "00", "0x10", "1_000", "\n1", "1\n", "1.00", "Infinity", "NaN", {}, [], 0n]) {
    assert.throws(() => parseMinorUnits(bad));
  }
});
