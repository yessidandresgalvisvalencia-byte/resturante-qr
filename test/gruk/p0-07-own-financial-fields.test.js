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

test('P0-07: hostile inherited getters are never evaluated', () => {
  let getterCalls = 0;
  const prototype = {};
  for (const key of ['unitPrice', 'quantity']) {
    Object.defineProperty(prototype, key, {
      get() { getterCalls++; throw new Error('inherited getter executed'); }
    });
  }
  const inheritedOnly = Object.create(prototype);
  assert.throws(() => invoiceTotal([inheritedOnly]), TypeError);
  const explicit = Object.create(prototype);
  Object.defineProperties(explicit, {
    unitPrice: { value: '0.25' },
    quantity: { value: '4' }
  });
  assert.equal(invoiceTotal([explicit]), '1.00');
  assert.equal(getterCalls, 0);
});

test('P0-07: malformed own descriptors fail without executing fallback prototype accessors', () => {
  let getterCalls = 0;
  const prototype = Object.create(null);
  Object.defineProperty(prototype, 'quantity', {
    get() { getterCalls++; throw new Error('fallback quantity getter executed'); }
  });
  const line = Object.create(prototype);
  Object.defineProperty(line, 'unitPrice', { value: '1.00' });
  assert.throws(() => invoiceTotal([line]), TypeError);
  assert.equal(getterCalls, 0);
});

test('P0-07: invoice ignores overridden array iterator and totals every indexed line', () => {
  let iteratorCalls = 0;
  const lines = [{ unitPrice: '1.00', quantity: '2' }, { unitPrice: '0.25', quantity: '4' }];
  Object.defineProperty(lines, Symbol.iterator, {
    value() { iteratorCalls++; throw new Error('untrusted iterator executed'); }
  });
  assert.equal(invoiceTotal(lines), '3.00');
  assert.equal(iteratorCalls, 0);
});

test('P0-07: sparse invoice arrays cannot silently omit financial lines', () => {
  const lines = new Array(2);
  lines[1] = { unitPrice: '1.00', quantity: '1' };
  assert.throws(() => invoiceTotal(lines), TypeError);
});


test('P0-07: inherited array indices cannot inject invoice lines', () => {
  let getterCalls = 0;
  const inherited = Object.create(Array.prototype);
  Object.defineProperty(inherited, '0', {
    get() { getterCalls++; throw new Error('inherited invoice line executed'); }
  });
  const lines = new Array(1);
  Object.setPrototypeOf(lines, inherited);
  assert.throws(() => invoiceTotal(lines), TypeError);
  assert.equal(getterCalls, 0, 'invoice must reject holes before reading inherited indices');
});

test('P0-07: accessor array indices cannot execute while totaling invoices', () => {
  let calls = 0;
  const lines = new Array(1);
  Object.defineProperty(lines, '0', {
    configurable: true,
    get() { calls++; throw new Error('invoice index getter executed'); }
  });
  assert.throws(() => invoiceTotal(lines), TypeError);
  assert.equal(calls, 0);
});

test('P0-07: immutable nonenumerable own array index remains valid', () => {
  const lines = new Array(1);
  Object.defineProperty(lines, '0', { value: { unitPrice: '0.75', quantity: '2' } });
  assert.equal(invoiceTotal(lines), '1.50');
});
