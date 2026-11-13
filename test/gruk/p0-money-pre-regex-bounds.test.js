'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMoneyToCents } = require('../../core/finance/enterpriseMoney');
const { lineTotal, invoiceTotal, taxAmount, reconcile } = require('../../core/finance/enterpriseMoneyOperations');

test('P0-07 bounds oversized money before canonical regex and downstream arithmetic', () => {
  const oversized = '9'.repeat(1_000_000);
  assert.throws(() => parseMoneyToCents(oversized), RangeError);
  assert.throws(() => lineTotal(oversized, '1'), RangeError);
  assert.throws(() => invoiceTotal([{ unitPrice: oversized, quantity: '1' }]), RangeError);
  assert.throws(() => taxAmount(oversized, '1900'), RangeError);
  assert.throws(() => reconcile('0.00', oversized), RangeError);
});

test('P0-07 retains canonical validation and exact safe-cent boundary', () => {
  assert.equal(parseMoneyToCents('90071992547409.91'), 9007199254740991n);
  assert.throws(() => parseMoneyToCents('90071992547409.92'), RangeError);
  assert.throws(() => parseMoneyToCents('01.00'), TypeError);
  assert.throws(() => parseMoneyToCents('1.000'), TypeError);
  assert.equal(parseMoneyToCents('0.01'), 1n);
});
