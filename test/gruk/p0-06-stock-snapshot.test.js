'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

test('P0-06 snapshot reconciles multiple SKUs exactly without mutating source', () => {
  const rows = Object.freeze([
    Object.freeze({ sku: 'A', recorded: '9007199254740991', counted: '0' }),
    Object.freeze({ sku: 'B', recorded: '2', counted: '7' })
  ]);
  const result = reconcileStockSnapshot(rows);
  assert.deepEqual(result, [
    { sku: 'A', matches: false, differenceUnits: '-9007199254740991', absoluteDifferenceUnits: '9007199254740991' },
    { sku: 'B', matches: false, differenceUnits: '5', absoluteDifferenceUnits: '5' }
  ]);
  assert.ok(Object.isFrozen(result));
  assert.ok(result.every(Object.isFrozen));
  assert.equal(rows[0].recorded, '9007199254740991');
});

test('P0-06 snapshot rejects duplicate SKU rather than double-counting', () => {
  assert.throws(() => reconcileStockSnapshot([
    { sku: 'A', recorded: '1', counted: '2' },
    { sku: 'A', recorded: '3', counted: '4' }
  ]), /Duplicate SKU/);
});

test('P0-06 snapshot rejects inherited fields and invalid quantities atomically', () => {
  assert.throws(() => reconcileStockSnapshot([Object.create({ sku: 'A', recorded: '1', counted: '2' })]), TypeError);
  assert.throws(() => reconcileStockSnapshot([
    { sku: 'A', recorded: '1', counted: '2' },
    { sku: 'B', recorded: '1', counted: '-2' }
  ]), TypeError);
  assert.throws(() => reconcileStockSnapshot([{ sku: 'A\nB', recorded: '0', counted: '0' }]), TypeError);
  assert.throws(() => reconcileStockSnapshot(null), TypeError);
  assert.deepEqual(reconcileStockSnapshot([]), []);
});
