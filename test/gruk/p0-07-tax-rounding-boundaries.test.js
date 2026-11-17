'use strict';

// Plan Maestro 07 [P0]: deterministic tax arithmetic, not a tax-policy decision.
// No database, personal-finance, Blushea, or production side effects.
const test = require('node:test');
const assert = require('node:assert/strict');
const { taxAmount } = require('../../core/finance/enterpriseMoneyOperations');

test('taxAmount rounds positive half-cent ties up using integer basis points', () => {
  assert.equal(taxAmount('0.01', '5000'), '0.01');
  assert.equal(taxAmount('0.01', '4999'), '0.00');
  assert.equal(taxAmount('0.03', '5000'), '0.02');
  assert.equal(taxAmount('100.00', '1900'), '19.00');
});

test('taxAmount respects zero and full-rate boundaries exactly', () => {
  assert.equal(taxAmount('90071992547409.91', '0'), '0.00');
  assert.equal(taxAmount('90071992547409.91', '10000'), '90071992547409.91');
  assert.equal(taxAmount('0.00', '10000'), '0.00');
});

test('taxAmount rejects ambiguous, noncanonical or excessive tax rates', () => {
  for (const rate of ['-1', '+1', '01', '1.0', '1e2', '10001', '', ' 1900', '1900 ', '999999']) {
    assert.throws(() => taxAmount('1.00', rate), { name: /^(TypeError|RangeError)$/ });
  }
  for (const rate of [1900, 0, null, undefined, 19.0, 1900n]) {
    assert.throws(() => taxAmount('1.00', rate), TypeError);
  }
});

test('taxAmount rejects noncanonical money rather than silently rounding input', () => {
  for (const amount of ['0.001', '-1.00', '1e2', '01.00', '1,00']) {
    assert.throws(() => taxAmount(amount, '1900'), TypeError);
  }
});
