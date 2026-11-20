'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { taxAmount, invoiceTotal, lineTotal, reconcile } = require('../../core/finance/enterpriseMoneyOperations');

// Plan Maestro P0-07: deterministic COP minor-unit arithmetic. These are
// contract tests, not evidence of tax-policy correctness or end-to-end readiness.
test('P0-07 tax uses exact HALF UP at a one-cent boundary', () => {
  assert.equal(taxAmount('0.01', '4999'), '0.00');
  assert.equal(taxAmount('0.01', '5000'), '0.01');
  assert.equal(taxAmount('0.01', '5001'), '0.01');
  assert.equal(taxAmount('0.03', '5000'), '0.02');
  assert.equal(taxAmount('0.05', '1000'), '0.01');
});

test('P0-07 tax at 0 and 100 percent preserves safe-cent bounds', () => {
  assert.equal(taxAmount('90071992547409.91', '0'), '0.00');
  assert.equal(taxAmount('90071992547409.91', '10000'), '90071992547409.91');
  assert.equal(taxAmount('0.00', '10000'), '0.00');
});

test('P0-07 invoice aggregates exact cents independent of line order', () => {
  const lines = [
    { unitPrice: '0.01', quantity: '3' },
    { unitPrice: '0.10', quantity: '7' },
    { unitPrice: '1.25', quantity: '2' }
  ];
  assert.equal(invoiceTotal(lines), '3.23');
  assert.equal(invoiceTotal([...lines].reverse()), '3.23');
  assert.equal(lineTotal('0.01', '3'), '0.03');
  assert.deepEqual(reconcile('3.23', '3.22'), {
    matches: false, differenceCents: '-1', absoluteDifference: '0.01'
  });
});

test('P0-07 rejects ambiguous and out-of-policy tax rates', () => {
  for (const invalid of ['-1', '01', '1.0', '1e2', ' 100', '', '10001', '999999']) {
    assert.throws(() => taxAmount('1.00', invalid));
  }
});
