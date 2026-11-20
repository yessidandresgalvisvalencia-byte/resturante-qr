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

test('P0-06: payment ordering does not change the exact reconciliation result', () => {
  const payments = Object.freeze(['0.01', '90071992547409.91', '0.02', '90071992547409.91']);
  const forward = reconcileSalePayments('0.03', payments);
  const reversed = reconcileSalePayments('0.03', [...payments].reverse());
  assert.deepEqual(forward, reversed);
  assert.equal(forward.capturedCents, '18014398509481985');
  assert.equal(forward.differenceCents, '18014398509481982');
  assert.equal(forward.status, 'overpayment');
});

test('P0-06: accepts exactly 10000 payments and rejects 10001 before iterating entries', () => {
  const atLimit = Array(10000).fill('0.01');
  assert.deepEqual(reconcileSalePayments('100', atLimit), {
    expectedCents: '10000', capturedCents: '10000', differenceCents: '0', status: 'balanced'
  });
  const beyondLimit = Array(10001).fill('0.01');
  Object.defineProperty(beyondLimit, '0', {
    get() { throw new Error('payment entries must not be inspected above the limit'); }
  });
  assert.throws(() => reconcileSalePayments('100', beyondLimit), RangeError);
});

test('P0-06: invalid expected sale amount fails before accessing payment entries', () => {
  const payments = Object.freeze(['1.00']);
  for (const invalid of [1, null, undefined, '-1', '1.001', '1e3', '01', '90071992547409.92']) {
    assert.throws(() => reconcileSalePayments(invalid, payments));
  }
  const guarded = new Proxy(['1.00'], {
    get() { throw new Error('payments should not be inspected for invalid sale amounts'); }
  });
  assert.throws(() => reconcileSalePayments('-1', guarded), TypeError);
});

test('P0-06: invalid payment in a split collection is rejected, never silently skipped', () => {
  for (const invalid of [undefined, null, '', '1.001', '-0.01', 0, {}, '90071992547409.92']) {
    assert.throws(() => reconcileSalePayments('2.00', ['1.00', invalid, '1.00']));
  }
  assert.throws(() => reconcileSalePayments('1.00', new Array(1)), TypeError);
});

test('P0-06: payment accessors are rejected without executing caller code', () => {
  let executed = false;
  const payments = ['1.00'];
  Object.defineProperty(payments, '0', {
    configurable: true,
    get() { executed = true; throw new Error('untrusted getter'); }
  });
  assert.throws(() => reconcileSalePayments('1.00', payments), TypeError);
  assert.equal(executed, false);
});

test('P0-06: inherited array slots never count as captured payments', () => {
  const prototype = Object.create(Array.prototype);
  prototype[0] = '1.00';
  const payments = new Array(1);
  Object.setPrototypeOf(payments, prototype);
  assert.throws(() => reconcileSalePayments('1.00', payments), TypeError);
  assert.deepEqual(reconcileSalePayments('1.00', Object.freeze(['1.00'])), {
    expectedCents: '100', capturedCents: '100', differenceCents: '0', status: 'balanced'
  });
});
