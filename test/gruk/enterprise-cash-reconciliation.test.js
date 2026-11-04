"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileCash } = require("../../core/enterprise/cashReconciliation");

test("cash reconciliation handles values above safe integer exactly", () => {
  const result = reconcileCash({
    expected: "9007199254740993", counted: "9007199254740995", tolerance: "2"
  });
  assert.deepEqual(result, {
    expected: "9007199254740993", counted: "9007199254740995",
    difference: "2", withinTolerance: true
  });
  assert.ok(Object.isFrozen(result));
});
test("shortage and overage are signed and tolerance is inclusive", () => {
  assert.equal(reconcileCash({ expected: "100", counted: "97", tolerance: "2" }).difference, "-3");
  assert.equal(reconcileCash({ expected: "100", counted: "97", tolerance: "2" }).withinTolerance, false);
  assert.equal(reconcileCash({ expected: "100", counted: "97", tolerance: "3" }).withinTolerance, true);
  assert.equal(reconcileCash({ expected: "100", counted: "105" }).withinTolerance, false);
});
test("rejects floats, noncanonical values, negative tolerance and overflow", () => {
  assert.throws(() => reconcileCash({ expected: 100, counted: "100" }));
  assert.throws(() => reconcileCash({ expected: "01", counted: "100" }));
  assert.throws(() => reconcileCash({ expected: "100", counted: "100", tolerance: "-1" }));
  assert.throws(() => reconcileCash({ expected: "9".repeat(30), counted: "-9".repeat(1) + "9".repeat(29) }), RangeError);
});
