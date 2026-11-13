'use strict';

// Plan Maestro P0-07: deterministic invoice arithmetic, metamorphic regressions.
// Enterprise-only pure module; no databases, services, or personal-finance dependencies.
const test = require('node:test');
const assert = require('node:assert/strict');
const { invoiceTotal, lineTotal } = require('../../core/finance/enterpriseMoneyOperations');

test('P0-07 invoice total is independent of line order', () => {
  const lines = [
    { unitPrice: '123456789.12', quantity: '3' },
    { unitPrice: '0.01', quantity: '7' },
    { unitPrice: '999999.99', quantity: '2' },
    { unitPrice: '0.00', quantity: '0' }
  ];
  const expected = invoiceTotal(lines);
  assert.equal(invoiceTotal([...lines].reverse()), expected);
  assert.equal(invoiceTotal([lines[2], lines[0], lines[3], lines[1]]), expected);
});

test('P0-07 splitting one line preserves the exact invoice amount', () => {
  const combined = [{ unitPrice: '123456789.12', quantity: '9' }];
  const split = [
    { unitPrice: '123456789.12', quantity: '4' },
    { unitPrice: '123456789.12', quantity: '5' }
  ];
  assert.equal(invoiceTotal(combined), invoiceTotal(split));
  assert.equal(invoiceTotal(split), '1111111102.08');
});

test('P0-07 zero quantity and zero price are additive identities', () => {
  const paid = { unitPrice: '250.75', quantity: '4' };
  const zeros = [
    { unitPrice: '90071992547409.91', quantity: '0' },
    { unitPrice: '0.00', quantity: '9007199254740991' }
  ];
  assert.equal(invoiceTotal([paid, ...zeros]), lineTotal(paid.unitPrice, paid.quantity));
  assert.equal(invoiceTotal(zeros), '0.00');
});

test('P0-07 malformed lines fail closed regardless of line position', () => {
  const valid = { unitPrice: '1.00', quantity: '1' };
  for (const invalid of [null, [], '1.00', { unitPrice: '1.00', quantity: '-1' }]) {
    assert.throws(() => invoiceTotal([invalid, valid]));
    assert.throws(() => invoiceTotal([valid, invalid]));
  }
});
