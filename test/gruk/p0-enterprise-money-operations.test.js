'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { lineTotal, invoiceTotal, reconcile } = require('../../core/finance/enterpriseMoneyOperations');

test('exact invoice arithmetic with fractional cents input', () => {
  assert.equal(lineTotal('0.29', '3'), '0.87');
  assert.equal(invoiceTotal([{ unitPrice: '0.29', quantity: '3' }, { unitPrice: '0.01', quantity: '13' }]), '1.00');
  assert.equal(invoiceTotal([]), '0.00');
  assert.equal(lineTotal('0.01', '0'), '0.00');
});
test('reconciliation keeps direction and exact difference', () => {
  assert.deepEqual(reconcile('1.00', '0.99'), { matches: false, differenceCents: '-1', absoluteDifference: '0.01' });
  assert.deepEqual(reconcile('0.99', '1.00'), { matches: false, differenceCents: '1', absoluteDifference: '0.01' });
  assert.equal(reconcile('1', '1.00').matches, true);
});
test('rejects ambiguous quantities, prices, and invalid lines', () => {
  for (const quantity of [1, '-1', '1.0', '01', '1e3', '', ' 1']) {
    assert.throws(() => lineTotal('1.00', quantity));
  }
  for (const price of [1, '-1', '1,00', '1.001']) assert.throws(() => lineTotal(price, '1'));
  assert.throws(() => invoiceTotal(null), TypeError);
  assert.throws(() => invoiceTotal([null]), TypeError);
});
test('enforces safe cents boundary on each operation', () => {
  assert.equal(lineTotal('90071992547409.91', '1'), '90071992547409.91');
  assert.throws(() => lineTotal('90071992547409.91', '2'), RangeError);
  assert.throws(() => invoiceTotal([{unitPrice:'90071992547409.91',quantity:'1'}, {unitPrice:'0.01',quantity:'1'}]), RangeError);
});

test('rejects oversized quantities including zero-price denial-of-service inputs', () => {
  assert.equal(lineTotal('0.00', '9007199254740991'), '0.00');
  for (const quantity of ['9007199254740992', '9'.repeat(100000)]) {
    assert.throws(() => lineTotal('0.00', quantity), RangeError);
    assert.throws(() => invoiceTotal([{ unitPrice: '0.00', quantity }]), RangeError);
  }
});
