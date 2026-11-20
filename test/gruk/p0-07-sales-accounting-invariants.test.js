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

test('P0-07: legacy read-only bridge rejects unsafe or subcent monetary values', () => {
  const { canonicalLegacyMoney, calculateLegacySale } = require('../../core/finance/enterpriseSalesMath');
  for (const invalid of [NaN, Infinity, -Infinity, -0, -1, 0.001, 1.005, 1e-7, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => canonicalLegacyMoney(invalid), { name: /^(TypeError|RangeError)$/ });
  }
  for (const invalid of ['1.00', null, undefined, true, 1n]) {
    assert.throws(() => canonicalLegacyMoney(invalid), TypeError);
  }
  assert.equal(canonicalLegacyMoney(0), '0');
  assert.equal(canonicalLegacyMoney(1.25), '1.25');
  const result = calculateLegacySale({ quantity: 2, unitPrice: 1.25, unitCost: 0.50, total: 2.00 });
  assert.deepEqual({ gross: result.grossCents, revenue: result.revenueCents, cost: result.costCents, profit: result.profitCents }, {
    gross: '250', revenue: '200', cost: '100', profit: '100'
  });
  for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2']) {
    assert.throws(() => calculateLegacySale({ quantity, unitPrice: 1, unitCost: 0, total: 1 }), TypeError);
  }
});


test('P0-07: negative profit and maximum safe-cent boundary remain exact', () => {
  const loss = calculateSale({ quantity: '3', unitPrice: '0.01', unitCost: '0.99', total: '0.01' });
  assert.deepEqual({
    gross: loss.grossCents, discount: loss.discountCents,
    revenue: loss.revenueCents, cost: loss.costCents,
    profit: loss.profitCents, margin: loss.marginBasisPoints
  }, {
    gross: '3', discount: '2', revenue: '1', cost: '297',
    profit: '-296', margin: '-2960000'
  });

  // The largest permitted single-line amount must not lose one cent.
  const boundary = calculateSale({
    quantity: '1', unitPrice: '90071992547409.91',
    unitCost: '0', total: '90071992547409.91'
  });
  assert.equal(boundary.grossCents, Number.MAX_SAFE_INTEGER.toString());
  assert.equal(boundary.revenueCents, Number.MAX_SAFE_INTEGER.toString());
  assert.equal(boundary.profitCents, Number.MAX_SAFE_INTEGER.toString());
  assert.throws(() => calculateSale({
    quantity: '1', unitPrice: '90071992547409.92',
    unitCost: '0', total: '0'
  }), RangeError);
});
