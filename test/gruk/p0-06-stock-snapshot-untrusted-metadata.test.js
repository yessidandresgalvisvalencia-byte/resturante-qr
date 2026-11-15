'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

test('P0-06: irrelevant accessor fields never execute during a read-only count', () => {
  let invoked = 0;
  const row = { sku: 'SAFE-01', recorded: '12', counted: '9' };
  Object.defineProperty(row, 'metadata', {
    enumerable: true,
    get() { invoked += 1; throw new Error('untrusted metadata accessor executed'); }
  });
  const result = reconcileStockSnapshot(Object.freeze([Object.freeze(row)]));
  assert.equal(invoked, 0);
  assert.deepEqual(result, [{
    sku: 'SAFE-01', matches: false,
    differenceUnits: '-3', absoluteDifferenceUnits: '3'
  }]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result[0]), true);
});

test('P0-06: invalid last row never returns a partial reconciliation', () => {
  const rows = [
    Object.freeze({ sku: 'SAFE-01', recorded: '5', counted: '4' }),
    Object.freeze({ sku: 'SAFE-02', recorded: '2', counted: '3' }),
    Object.freeze({ sku: 'SAFE-01', recorded: '1', counted: '1' })
  ];
  assert.throws(() => reconcileStockSnapshot(Object.freeze(rows)), /Duplicate SKU/);
  assert.deepEqual(rows.map(row => row.sku), ['SAFE-01', 'SAFE-02', 'SAFE-01']);
});

test('P0-06: invalid quantities do not trigger coercion of foreign objects', () => {
  let invoked = 0;
  const untrusted = {
    toString() { invoked += 1; throw new Error('coercion executed'); },
    valueOf() { invoked += 1; throw new Error('coercion executed'); }
  };
  assert.throws(() => reconcileStockSnapshot([
    { sku: 'SAFE-01', recorded: untrusted, counted: '0' }
  ]), TypeError);
  assert.equal(invoked, 0);
});
