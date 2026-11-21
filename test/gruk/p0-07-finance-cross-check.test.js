'use strict';

// GRUK Empresarial P0-07: independently cross-check the deterministic finance primitives.
// These tests deliberately avoid MongoDB, HTTP, and personal-finance modules.
const test = require('node:test');
const assert = require('node:assert/strict');
const { lineTotal, invoiceTotal, reconcile, taxAmount } = require('../../core/finance/enterpriseMoneyOperations');

test('P0-07: item totals reconcile exactly with an invoice across cent boundaries', () => {
  const lines = [
    { unitPrice: '0.01', quantity: '3' },
    { unitPrice: '1234567.89', quantity: '2' },
    { unitPrice: '0.00', quantity: '999999' }
  ];
  assert.deepEqual(lines.map(line => lineTotal(line.unitPrice, line.quantity)), [
    '0.03', '2469135.78', '0.00'
  ]);
  const total = invoiceTotal(lines);
  assert.equal(total, '2469135.81');
  assert.deepEqual(reconcile(total, '2469135.81'), {
    matches: true, differenceCents: '0', absoluteDifference: '0.00'
  });
});

test('P0-07: reconciliation preserves direction and exact cents for underpayment and overpayment', () => {
  assert.deepEqual(reconcile('100.00', '99.99'), {
    matches: false, differenceCents: '-1', absoluteDifference: '0.01'
  });
  assert.deepEqual(reconcile('100.00', '100.01'), {
    matches: false, differenceCents: '1', absoluteDifference: '0.01'
  });
});

test('P0-07: line and invoice overflow fail closed rather than rounding or wrapping', () => {
  assert.throws(() => lineTotal('90071992547409.91', '2'), RangeError);
  assert.throws(() => invoiceTotal([
    { unitPrice: '90071992547409.91', quantity: '1' },
    { unitPrice: '0.01', quantity: '1' }
  ]), RangeError);
});

test('P0-07: explicit tax rate is deterministic and rejects noncanonical basis points', () => {
  assert.equal(taxAmount('0.03', '1900'), '0.01');
  assert.equal(taxAmount('0.02', '1900'), '0.00');
  assert.throws(() => taxAmount('100.00', '01900'), TypeError);
  assert.throws(() => taxAmount('100.00', '10001'), RangeError);
});
