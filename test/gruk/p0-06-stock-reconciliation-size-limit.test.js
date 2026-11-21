'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

test('P0-06: snapshot row limit rejects oversized arrays before touching any row', () => {
  let touched = 0;
  const hostile = { get sku() { touched++; throw new Error('must not inspect row'); } };
  const oversized = Array(10001).fill(hostile);
  assert.throws(() => reconcileStockSnapshot(oversized), {
    name: 'RangeError',
    message: 'Stock snapshot exceeds 10000 rows'
  });
  assert.equal(touched, 0);
});

test('P0-06: 10000-row boundary is accepted with exact immutable results', () => {
  const rows = Array.from({ length: 10000 }, (_, i) => ({
    sku: 'SKU-' + i, recorded: '2', counted: '1'
  }));
  const result = reconcileStockSnapshot(rows);
  assert.equal(result.length, 10000);
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(result[9999], {
    sku: 'SKU-9999', matches: false,
    differenceUnits: '-1', absoluteDifferenceUnits: '1'
  });
  assert.equal(Object.isFrozen(result[9999]), true);
  assert.equal(rows[9999].counted, '1');
});
