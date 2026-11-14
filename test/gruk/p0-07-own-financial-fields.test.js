'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { invoiceTotal } = require('../../core/finance/enterpriseMoneyOperations');

test('P0-07: invoice line must explicitly own both monetary inputs', () => {
  const inherited = Object.create({ unitPrice: '999.00', quantity: '9' });
  assert.throws(() => invoiceTotal([inherited]), TypeError);
  const inheritedQuantity = Object.assign(Object.create({ quantity: '9' }), { unitPrice: '2.00' });
  assert.throws(() => invoiceTotal([inheritedQuantity]), TypeError);
  const inheritedPrice = Object.assign(Object.create({ unitPrice: '2.00' }), { quantity: '9' });
  assert.throws(() => invoiceTotal([inheritedPrice]), TypeError);
});

test('P0-07: explicit own fields remain valid even on custom or null prototypes', () => {
  const nullPrototype = Object.assign(Object.create(null), { unitPrice: '0.01', quantity: '3' });
  const customPrototype = Object.assign(Object.create({ unitPrice: '999.00' }), {
    unitPrice: '1.20',
    quantity: '2'
  });
  assert.equal(invoiceTotal([nullPrototype, customPrototype]), '2.43');
  assert.equal(invoiceTotal([{ unitPrice: '2.00', quantity: '2' }]), '4.00');
});

test('P0-07: inherited line fields cannot influence an otherwise valid invoice', () => {
  const line = Object.assign(Object.create({ unitPrice: '500.00', quantity: '100' }), {
    unitPrice: '0.05',
    quantity: '2'
  });
  assert.equal(invoiceTotal([line]), '0.10');
});

test('P0-07: accessors cannot execute while calculating financial totals', () => {
  let calls = 0;
  const priceAccessor = { quantity: '1' };
  Object.defineProperty(priceAccessor, 'unitPrice', { enumerable: true, get() { calls++; return '1.00'; } });
  assert.throws(() => invoiceTotal([priceAccessor]), TypeError);
  const quantityAccessor = { unitPrice: '1.00' };
  Object.defineProperty(quantityAccessor, 'quantity', { enumerable: true, get() { calls++; return '1'; } });
  assert.throws(() => invoiceTotal([quantityAccessor]), TypeError);
  assert.equal(calls, 0, 'invoice must never invoke user-controlled getters');
});

test('P0-07: explicit nonenumerable immutable financial data fields remain valid', () => {
  const line = Object.create(null);
  Object.defineProperty(line, 'unitPrice', { value: '1.25' });
  Object.defineProperty(line, 'quantity', { value: '2' });
  assert.equal(invoiceTotal([line]), '2.50');
});
