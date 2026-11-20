'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileSalePayments } = require('../../core/finance/enterprisePaymentReconciliation');

test('P0-06: exact reconciliation of split payments and one-cent differences', () => {
  assert.deepEqual(reconcileSalePayments('10.01', ['3.33', '6.68']), {
    expectedCents: '1001', capturedCents: '1001', differenceCents: '0', status: 'balanced'
  });
  assert.deepEqual(reconcileSalePayments('10.01', ['10.00']), {
    expectedCents: '1001', capturedCents: '1000', differenceCents: '-1', status: 'shortfall'
  });
  assert.deepEqual(reconcileSalePayments('10.01', ['10.02']), {
    expectedCents: '1001', capturedCents: '1002', differenceCents: '1', status: 'overpayment'
  });
  assert.equal(reconcileSalePayments('0', []).status, 'balanced');
  assert.equal(reconcileSalePayments('1', []).differenceCents, '-100');
});

test('P0-06: rejects ambiguous amounts and non-array payments without mutation', () => {
  const payments = Object.freeze(['0.10', '0.20']);
  const result = reconcileSalePayments('0.30', payments);
  assert.equal(result.status, 'balanced');
  assert.ok(Object.isFrozen(result));
  for (const invalid of [0.1, '-1', '1.001', '1e3', null, undefined]) {
    assert.throws(() => reconcileSalePayments('1', [invalid]));
  }
  assert.throws(() => reconcileSalePayments('1', '1'), TypeError);
  assert.throws(() => reconcileSalePayments('1', new Array(10001).fill('0')), RangeError);
});

test('P0-06: sum of safe individual payments stays exact beyond Number safe integer', () => {
  const result = reconcileSalePayments('0', ['90071992547409.91', '90071992547409.91']);
  assert.equal(result.capturedCents, '18014398509481982');
  assert.equal(result.differenceCents, '18014398509481982');
  assert.equal(result.status, 'overpayment');
});
