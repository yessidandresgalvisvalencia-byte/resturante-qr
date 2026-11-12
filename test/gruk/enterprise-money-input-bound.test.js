'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMoneyToCents, formatCents } = require('../../core/finance/enterpriseMoney');
const { lineTotal, invoiceTotal, reconcile } = require('../../core/finance/enterpriseMoneyOperations');

test('P0-07 exact boundary of safe cents is accepted', () => {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  assert.equal(parseMoneyToCents('90071992547409.91'), max);
  assert.equal(formatCents(max), '90071992547409.91');
  assert.throws(() => parseMoneyToCents('90071992547409.92'), RangeError);
});

test('P0-07 rejects oversized input before expensive BigInt parsing', () => {
  assert.throws(() => parseMoneyToCents('9'.repeat(100000)), RangeError);
  assert.throws(() => parseMoneyToCents('0'.repeat(100000)), TypeError);
  assert.throws(() => parseMoneyToCents('100000000000000.00'), RangeError);
});

test('P0-07 canonical decimals and invoice reconciliation remain exact', () => {
  assert.equal(lineTotal('0.10', '3'), '0.30');
  assert.equal(invoiceTotal([{unitPrice:'0.10', quantity:'3'}, {unitPrice:'0.20',quantity:'1'}]), '0.50');
  assert.deepEqual(reconcile('0.50','0.49'), {matches:false,differenceCents:'-1',absoluteDifference:'0.01'});
  for (const bad of ['1e3','1,00','-1','01','1.001','NaN']) assert.throws(() => parseMoneyToCents(bad), TypeError);
});
