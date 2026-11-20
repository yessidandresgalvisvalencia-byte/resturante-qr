'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { invoiceTotal } = require('../../core/finance/enterpriseMoneyOperations');

test('P0-07: sparse invoice holes cannot silently omit a monetary line', () => {
  const sparse = [{ unitPrice: '10.00', quantity: '1' }, , { unitPrice: '5.00', quantity: '1' }];
  assert.throws(() => invoiceTotal(sparse), { name: 'TypeError', message: 'Sparse invoice line' });
});

test('P0-07: a deleted first line is rejected, including single-hole arrays', () => {
  const deleted = [{ unitPrice: '7.00', quantity: '1' }];
  delete deleted[0];
  assert.throws(() => invoiceTotal(deleted), TypeError);
  assert.throws(() => invoiceTotal(new Array(1)), TypeError);
});

test('P0-07: dense zero-valued and empty invoices preserve exact totals', () => {
  assert.equal(invoiceTotal([]), '0.00');
  assert.equal(invoiceTotal([{ unitPrice: '0.01', quantity: '0' }, { unitPrice: '0.02', quantity: '2' }]), '0.04');
});

test('P0-07: inherited array slots cannot masquerade as explicitly supplied invoice lines', () => {
  const inherited = new Array(1);
  const prototype = Object.create(Array.prototype);
  prototype[0] = { unitPrice: '99.99', quantity: '1' };
  Object.setPrototypeOf(inherited, prototype);
  assert.throws(() => invoiceTotal(inherited), { name: 'TypeError', message: 'Sparse invoice line' });
});
