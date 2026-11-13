'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { lineTotal, invoiceTotal, reconcile, taxAmount } = require('../../core/finance/enterpriseMoneyOperations');

// Plan Maestro item 07: unit-level invariants only; not an E2E certification.
test('P0-07 reconciliation preserves signed one-cent differences at safe boundary', () => {
  const maximum = '90071992547409.91';
  assert.deepEqual(reconcile(maximum, '90071992547409.90'), {
    matches: false, differenceCents: '-1', absoluteDifference: '0.01'
  });
  assert.deepEqual(reconcile('90071992547409.90', maximum), {
    matches: false, differenceCents: '1', absoluteDifference: '0.01'
  });
  assert.deepEqual(reconcile(maximum, maximum), {
    matches: true, differenceCents: '0', absoluteDifference: '0.00'
  });
});

test('P0-07 line and invoice reject overflow instead of rounding unsafe cents', () => {
  assert.equal(lineTotal('90071992547409.91', '1'), '90071992547409.91');
  assert.equal(invoiceTotal([{ unitPrice: '90071992547409.91', quantity: '1' }]), '90071992547409.91');
  assert.throws(() => lineTotal('90071992547409.91', '2'), RangeError);
  assert.throws(() => invoiceTotal([
    { unitPrice: '90071992547409.91', quantity: '1' },
    { unitPrice: '0.01', quantity: '1' }
  ]), RangeError);
});

test('P0-07 tax calculation remains exact at the maximum safe cent amount', () => {
  assert.equal(taxAmount('90071992547409.91', '10000'), '90071992547409.91');
  assert.equal(taxAmount('90071992547409.91', '0'), '0.00');
});
