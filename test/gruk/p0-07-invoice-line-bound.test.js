'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { invoiceTotal, lineTotal, reconcile } = require('../../core/finance/enterpriseMoneyOperations');

test('P0-07: exactly 10000 invoice lines are processed deterministically', () => {
  const lines = Array.from({length: 10000}, () => ({unitPrice: '0.01', quantity: '1'}));
  assert.equal(invoiceTotal(lines), '100.00');
});

test('P0-07: reject 10001 lines before inspecting malformed entries', () => {
  const lines = Array(10001).fill(null);
  assert.throws(() => invoiceTotal(lines), {name: 'RangeError', message: 'Invoice exceeds maximum line count'});
});

test('P0-07: reject oversized zero-price invoices without BigInt work', () => {
  const lines = Array.from({length: 10001}, () => ({unitPrice: '0.00', quantity: '0'}));
  assert.throws(() => invoiceTotal(lines), RangeError);
});

test('P0-07: preserve exact arithmetic and signed reconciliation', () => {
  assert.equal(lineTotal('0.03', '3'), '0.09');
  assert.deepEqual(reconcile('0.10', '0.09'), {matches:false,differenceCents:'-1',absoluteDifference:'0.01'});
});
