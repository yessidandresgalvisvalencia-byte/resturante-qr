'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { invoiceTotal, lineTotal, reconcile } = require('../../core/finance/enterpriseMoneyOperations');

// Plan Maestro 07 [P0]: enforce integer-cent safety at the boundary and
// reject malformed invoice arrays without accepting partial totals.
test('invoice at maximum safe cent value is exact, next cent fails closed', () => {
  assert.equal(invoiceTotal([{ unitPrice: '90071992547409.91', quantity: '1' }]), '90071992547409.91');
  assert.throws(
    () => invoiceTotal([{ unitPrice: '90071992547409.91', quantity: '1' }, { unitPrice: '0.01', quantity: '1' }]),
    RangeError
  );
  assert.throws(() => lineTotal('90071992547409.91', '2'), RangeError);
});

test('sparse and oversized invoice arrays fail closed', () => {
  const sparse = new Array(2);
  sparse[0] = { unitPrice: '1.00', quantity: '1' };
  assert.throws(() => invoiceTotal(sparse), TypeError);
  assert.throws(() => invoiceTotal(new Array(10001)), RangeError);
});

test('reconciliation retains exact signed cent differences at maximum bound', () => {
  assert.deepEqual(reconcile('90071992547409.91', '0.00'), {
    matches: false,
    differenceCents: '-9007199254740991',
    absoluteDifference: '90071992547409.91'
  });
});
