'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMoneyToCents } = require('../../core/finance/enterpriseMoney');
const { lineTotal, invoiceTotal, taxAmount, reconcile } = require('../../core/finance/enterpriseMoneyOperations');

test('P0-07 rejects huge canonical amounts before BigInt conversion', () => {
  const huge = '9'.repeat(100000);
  assert.throws(() => parseMoneyToCents(huge), RangeError);
  assert.throws(() => lineTotal(huge, '1'), RangeError);
  assert.throws(() => invoiceTotal([{ unitPrice: huge, quantity: '1' }]), RangeError);
  assert.throws(() => taxAmount(huge, '1900'), RangeError);
  assert.throws(() => reconcile('0.00', huge), RangeError);
});

test('P0-07 preserves exact boundary and rejects one cent beyond', () => {
  assert.equal(parseMoneyToCents('90071992547409.91'), 9007199254740991n);
  assert.throws(() => parseMoneyToCents('90071992547409.92'), RangeError);
  assert.equal(parseMoneyToCents('0.01'), 1n);
  assert.equal(parseMoneyToCents('0'), 0n);
});
