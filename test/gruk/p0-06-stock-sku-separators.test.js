'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

// Plan Maestro 06 [P0]: canonical SKU boundaries; partial evidence only.
test('P0-06: Unicode line and paragraph separators cannot enter stock reconciliation identifiers', () => {
  for (const separator of ['\u2028', '\u2029']) {
    const rows = Object.freeze([Object.freeze({
      sku: 'ITEM' + separator + '01', recorded: '2', counted: '3'
    })]);
    assert.throws(() => reconcileStockSnapshot(rows), TypeError);
    assert.equal(rows[0].sku, 'ITEM' + separator + '01');
  }
});

test('P0-06: ordinary multilingual identifiers remain valid without mutation', () => {
  const rows = Object.freeze([
    Object.freeze({ sku: 'CAFÉ-01', recorded: '2', counted: '3' }),
    Object.freeze({ sku: '商品-02', recorded: '7', counted: '7' })
  ]);
  const result = reconcileStockSnapshot(rows);
  assert.deepEqual(result.map(row => row.sku), ['CAFÉ-01', '商品-02']);
  assert.deepEqual(result.map(row => row.differenceUnits), ['1', '0']);
  assert.equal(Object.isFrozen(result), true);
  assert.ok(result.every(Object.isFrozen));
});
