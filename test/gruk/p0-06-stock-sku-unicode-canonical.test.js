'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

test('P0-06: reject decomposed Unicode SKU before visually identical identities can diverge', () => {
  const composed = 'CAF\u00c9';
  const decomposed = 'CAFE\u0301';
  assert.equal(decomposed.normalize('NFC'), composed);
  assert.throws(() => reconcileStockSnapshot([{ sku: decomposed, recorded: '1', counted: '1' }]), TypeError);
  assert.deepEqual(reconcileStockSnapshot([{ sku: composed, recorded: '1', counted: '1' }]).map(row => row.sku), [composed]);
});

test('P0-06: reject isolated UTF-16 surrogates without corrupting valid supplementary SKU', () => {
  for (const sku of ['BAD\uD800', '\uDC00BAD']) {
    assert.throws(() => reconcileStockSnapshot([{ sku, recorded: '0', counted: '0' }]), TypeError);
  }
  const sku = 'ITEM-\u{1F680}';
  assert.equal(reconcileStockSnapshot([{ sku, recorded: '2', counted: '3' }])[0].sku, sku);
});

test('P0-06: noncanonical final SKU aborts entire immutable batch', () => {
  const rows = Object.freeze([
    Object.freeze({ sku: 'VALID', recorded: '3', counted: '2' }),
    Object.freeze({ sku: 'CAFE\u0301', recorded: '1', counted: '1' })
  ]);
  assert.throws(() => reconcileStockSnapshot(rows), TypeError);
  assert.equal(rows[0].recorded, '3');
});
