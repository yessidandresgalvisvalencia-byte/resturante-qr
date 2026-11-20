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

test('P0-07: refuses inherited, accessor and proxy-controlled financial records', () => {
  const valid = { quantity: '1', unitPrice: '1.00', unitCost: '0.50', total: '1.00' };
  const inherited = Object.create({ quantity: '1' });
  Object.assign(inherited, { unitPrice: '1.00', unitCost: '0.50', total: '1.00' });
  assert.throws(() => calculateSale(inherited), TypeError);

  let getterCalls = 0;
  const accessor = { ...valid };
  Object.defineProperty(accessor, 'total', {
    enumerable: true,
    get() { getterCalls += 1; throw new Error('must never execute'); }
  });
  assert.throws(() => calculateSale(accessor), TypeError);
  assert.equal(getterCalls, 0, 'financial input getter must not execute');

  assert.throws(() => calculateSale(new Proxy(valid, {
    getOwnPropertyDescriptor() { throw new Error('untrusted proxy trap'); }
  })), /untrusted proxy trap/);
});
