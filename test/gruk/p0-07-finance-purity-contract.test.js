'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { lineTotal, invoiceTotal, reconcile, taxAmount } =
  require('../../core/finance/enterpriseMoneyOperations');

// Plan Maestro 07: financial arithmetic must be deterministic and must not
// mutate caller-owned invoice data (including frozen data from other modules).
test('invoiceTotal accepts frozen inputs without mutation or order dependence', () => {
  const first = Object.freeze({ unitPrice: '12.34', quantity: '3' });
  const second = Object.freeze({ unitPrice: '0.01', quantity: '7' });
  const lines = Object.freeze([first, second]);
  const snapshot = JSON.stringify(lines);
  assert.equal(invoiceTotal(lines), '37.09');
  assert.equal(invoiceTotal(Object.freeze([second, first])), '37.09');
  assert.equal(invoiceTotal(lines), '37.09');
  assert.equal(JSON.stringify(lines), snapshot);
});

test('financial primitives are repeatable and return no shared mutable state', () => {
  for (let i = 0; i < 3; i++) {
    assert.equal(lineTotal('0.29', '3'), '0.87');
    assert.equal(taxAmount('0.03', '1900'), '0.01');
    assert.deepEqual(reconcile('10.00', '9.99'), {
      matches: false, differenceCents: '-1', absoluteDifference: '0.01'
    });
  }
  const result = reconcile('10.00', '9.99');
  assert.equal(Object.isFrozen(result), true);
  assert.throws(() => { result.matches = true; }, TypeError);
});

test('invalid frozen invoice line fails without modifying prior lines', () => {
  const valid = Object.freeze({ unitPrice: '2.50', quantity: '2' });
  const invalid = Object.freeze({ unitPrice: '1.00', quantity: '-1' });
  const lines = Object.freeze([valid, invalid]);
  assert.throws(() => invoiceTotal(lines), TypeError);
  assert.deepEqual(lines, [valid, invalid]);
  assert.equal(invoiceTotal(Object.freeze([valid])), '5.00');
});
