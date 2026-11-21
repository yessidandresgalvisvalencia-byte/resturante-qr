'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

// P0-06: pure reconciliation must not invoke attacker-controlled accessors.
test('P0-06 rejects getters in sku, recorded and counted without invoking them', () => {
  for (const key of ['sku', 'recorded', 'counted']) {
    let calls = 0;
    const row = { sku: 'A', recorded: '2', counted: '3' };
    Object.defineProperty(row, key, {
      enumerable: true,
      get() { calls++; throw new Error('getter executed'); }
    });
    assert.throws(() => reconcileStockSnapshot([row]), /data properties/);
    assert.equal(calls, 0, key);
  }
});

test('P0-06 accepts own non-enumerable and null-prototype data fields', () => {
  const row = Object.create(null);
  for (const [key, value] of Object.entries({ sku: 'A', recorded: '4', counted: '1' })) {
    Object.defineProperty(row, key, { value, enumerable: false });
  }
  assert.deepEqual(reconcileStockSnapshot([row]), [
    { sku: 'A', matches: false, differenceUnits: '-3', absoluteDifferenceUnits: '3' }
  ]);
});

test('P0-06 rejects an accessor after valid rows without leaking partial results', () => {
  let calls = 0;
  const row = { sku: 'B', recorded: '1' };
  Object.defineProperty(row, 'counted', { get() { calls++; return '9'; } });
  assert.throws(() => reconcileStockSnapshot([
    { sku: 'A', recorded: '1', counted: '1' }, row
  ]), /data properties/);
  assert.equal(calls, 0);
});
