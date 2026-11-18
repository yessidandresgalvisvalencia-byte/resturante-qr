'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { valueStock } = require('../../core/finance/enterpriseStockValuation');

test('P0-07: values stock exactly in COP cents without floating-point drift', () => {
  assert.deepEqual(valueStock([
    { unitCost: '0.10', quantity: '3' },
    { unitCost: '0.20', quantity: '2' },
    { unitCost: '100000.01', quantity: '2' }
  ]), { totalCost: '200000.72', totalCents: '20000072' });
});

test('P0-07: zero quantity, empty stock and immutable result', () => {
  assert.deepEqual(valueStock([]), { totalCost: '0.00', totalCents: '0' });
  const result = valueStock([{ unitCost: '100.00', quantity: '0' }]);
  assert.equal(result.totalCost, '0.00');
  assert.equal(Object.isFrozen(result), true);
});

test('P0-07: rejects malformed, noncanonical, negative and unsafe inputs', () => {
  for (const quantity of [0, -1, '01', '1.0', '1e2', '-1', '9007199254740992']) {
    assert.throws(() => valueStock([{ unitCost: '1.00', quantity }]));
  }
  for (const unitCost of [1, '-1', '1.001', '1e2', '01.00']) {
    assert.throws(() => valueStock([{ unitCost, quantity: '1' }]));
  }
  assert.throws(() => valueStock([{ unitCost: '90071992547409.91', quantity: '2' }]), RangeError);
});

test('P0-07: rejects sparse arrays and bounded batches', () => {
  const sparse = Array(1);
  assert.throws(() => valueStock(sparse), TypeError);
  assert.throws(() => valueStock(Array(10001)), RangeError);
  assert.throws(() => valueStock([null]), TypeError);
  assert.throws(() => valueStock({}), TypeError);
});


test('P0-07: rejects inherited costs and quantities rather than silently valuing stock', () => {
  const inheritedCost = Object.create({ unitCost: '100.00' });
  inheritedCost.quantity = '2';
  assert.throws(() => valueStock([inheritedCost]), TypeError);

  const inheritedQuantity = Object.create({ quantity: '2' });
  inheritedQuantity.unitCost = '100.00';
  assert.throws(() => valueStock([inheritedQuantity]), TypeError);

  const own = Object.create({ unitCost: '999.00', quantity: '999' });
  own.unitCost = '1.25';
  own.quantity = '2';
  assert.deepEqual(valueStock([own]), { totalCost: '2.50', totalCents: '250' });
});
