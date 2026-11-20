'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSale } = require('../../core/finance/enterpriseSalesMath');

// P0-07: deterministic cross-check against an independent BigInt cents oracle.
// These are pure unit tests, not MongoDB ledger/reconciliation evidence.
function money(cents) {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return whole.toString() + '.' + fraction;
}

test('P0-07: gross = revenue + discount and profit = revenue - cost across cent boundaries', () => {
  const prices = [0n, 1n, 9n, 10n, 99n, 100n, 101n, 999n, 10001n];
  const costs = [0n, 1n, 7n, 99n, 101n, 10001n];
  for (const quantity of [1n, 2n, 3n, 17n]) {
    for (const price of prices) {
      for (const cost of costs) {
        const gross = quantity * price;
        for (const charged of [0n, gross / 2n, gross]) {
          const result = calculateSale({
            quantity: quantity.toString(),
            unitPrice: money(price),
            unitCost: money(cost),
            total: money(charged)
          });
          const expectedCost = quantity * cost;
          const expectedProfit = charged - expectedCost;
          assert.equal(BigInt(result.grossCents), gross);
          assert.equal(BigInt(result.revenueCents) + BigInt(result.discountCents), gross);
          assert.equal(BigInt(result.costCents), expectedCost);
          assert.equal(BigInt(result.profitCents), expectedProfit);
          assert.equal(result.marginBasisPoints,
            charged === 0n ? null : (expectedProfit * 10000n / charged).toString());
          assert.ok(Object.isFrozen(result));
        }
      }
    }
  }
});

test('P0-07: rejects a charged amount one cent above the gross', () => {
  for (const quantity of ['1', '2', '17']) {
    const gross = BigInt(quantity) * 101n;
    assert.throws(() => calculateSale({
      quantity, unitPrice: '1.01', unitCost: '0.00', total: money(gross + 1n)
    }), RangeError);
  }
});
