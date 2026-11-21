"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateFinancialSnapshot } = require("../../core/enterprise/financialSnapshot");
const input = (overrides = {}) => ({
  sales: ["9007199254740993", "7"], costs: ["100"], cashIn: ["250"],
  cashOut: ["90"], receivables: ["80"], payables: ["30"], taxBasisPoints: "1900", ...overrides
});
test("deterministic enterprise financial snapshot preserves amounts above safe integer", () => {
  const result = calculateFinancialSnapshot(input());
  assert.deepEqual(result, {
    revenue: "9007199254741000", totalCosts: "100", margin: "9007199254740900",
    netCashFlow: "160", netReceivables: "50", estimatedTax: "1711367858400790"
  });
  assert.ok(Object.isFrozen(result));
});
test("negative refund and cash movement preserve exact signed arithmetic", () => {
  const result = calculateFinancialSnapshot(input({
    sales: ["-100"], costs: ["25"], cashIn: [], cashOut: ["100"],
    receivables: [], payables: ["40"], taxBasisPoints: "1900"
  }));
  assert.equal(result.margin, "-125");
  assert.equal(result.netCashFlow, "-100");
  assert.equal(result.netReceivables, "-40");
  assert.equal(result.estimatedTax, "-19");
});
test("fails closed on missing, floating, and malformed monetary inputs", () => {
  assert.throws(() => calculateFinancialSnapshot(input({ costs: undefined })), /costs/);
  assert.throws(() => calculateFinancialSnapshot(input({ sales: [1.5] })));
  assert.throws(() => calculateFinancialSnapshot(input({ taxBasisPoints: 19 })));
  assert.throws(() => calculateFinancialSnapshot(input({ cashOut: ["01"] })));
});
