'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMoneyToCents, formatCents } = require('../../core/finance/enterpriseMoney');
test('exact money parsing and formatting without float rounding', () => {
  for (const [amount, cents] of [['0', 0n], ['0.01', 1n], ['0.1', 10n], ['0.29', 29n], ['123456789.99', 12345678999n]]) {
    assert.equal(parseMoneyToCents(amount), cents);
    assert.equal(formatCents(cents), amount.includes('.') ? Number(amount.split('.')[1].length) === 1 ? amount + '0' : amount : amount + '.00');
  }
});
test('rejects floats, negative, ambiguous, malformed and oversized amounts', () => {
  for (const value of [0.1, -1, '-1', '01', '1,00', '1.234', '1e3', ' 1', '1.', '', '90071992547409.92', null]) {
    assert.throws(() => parseMoneyToCents(value));
  }
  assert.throws(() => formatCents(-1n));
  assert.throws(() => formatCents(1));
});
