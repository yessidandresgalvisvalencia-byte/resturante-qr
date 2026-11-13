'use strict';

// Plan Maestro 07 [P0]: audit tax rounding at the explicitly chosen base.
// This is partial evidence only: tax jurisdiction, inventory and E2E remain unverified.
const test = require('node:test');
const assert = require('node:assert/strict');
const { invoiceTotal, taxAmount } = require('../../core/finance/enterpriseMoneyOperations');

test('P0-07: invoice-base tax rounds once, not once per line', () => {
  const lines = Object.freeze([
    Object.freeze({ unitPrice: '0.01', quantity: '1' }),
    Object.freeze({ unitPrice: '0.01', quantity: '1' }),
    Object.freeze({ unitPrice: '0.01', quantity: '1' })
  ]);
  const base = invoiceTotal(lines);
  assert.equal(base, '0.03');
  assert.equal(taxAmount(base, '5000'), '0.02');
  const perLineTax = lines.map(line => taxAmount(line.unitPrice, '5000'));
  assert.deepEqual(perLineTax, ['0.01', '0.01', '0.01']);
  // These are intentionally different policies; the caller must choose.
  assert.notEqual(taxAmount(base, '5000'), '0.03');
});

test('P0-07: invoice-base tax remains deterministic under line permutation', () => {
  const lines = [
    { unitPrice: '0.01', quantity: '3' },
    { unitPrice: '0.02', quantity: '2' },
    { unitPrice: '1.23', quantity: '1' }
  ];
  const forward = taxAmount(invoiceTotal(lines), '1900');
  const backward = taxAmount(invoiceTotal([...lines].reverse()), '1900');
  assert.equal(forward, backward);
  assert.equal(forward, '0.25');
});

test('P0-07: zero-rate tax does not alter nonzero invoice base', () => {
  const base = invoiceTotal([{ unitPrice: '123456.78', quantity: '2' }]);
  assert.equal(base, '246913.56');
  assert.equal(taxAmount(base, '0'), '0.00');
  assert.equal(taxAmount(base, '10000'), base);
});
