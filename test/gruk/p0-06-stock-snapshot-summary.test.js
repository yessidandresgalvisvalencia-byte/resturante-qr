'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

test('P0-06 aggregate: empty, matched and mismatched counts are exact', () => {
  assert.deepEqual(summarizeStockSnapshot([]), {
    totalSkus: 0, matchedSkus: 0, mismatchedSkus: 0,
    shortageUnits: '0', surplusUnits: '0', netDifferenceUnits: '0'
  });
  const rows = Object.freeze([
    Object.freeze({ sku: 'A', recorded: '10', counted: '7' }),
    Object.freeze({ sku: 'B', recorded: '1', counted: '6' }),
    Object.freeze({ sku: 'C', recorded: '4', counted: '4' })
  ]);
  const result = summarizeStockSnapshot(rows);
  assert.deepEqual(result, {
    totalSkus: 3, matchedSkus: 1, mismatchedSkus: 2,
    shortageUnits: '3', surplusUnits: '5', netDifferenceUnits: '2'
  });
  assert.equal(Object.isFrozen(result), true);
  assert.throws(() => { result.netDifferenceUnits = '999'; }, TypeError);
  assert.equal(rows[0].counted, '7');
});

test('P0-06 aggregate: BigInt totals remain exact beyond Number.MAX_SAFE_INTEGER', () => {
  const rows = [
    { sku: 'A', recorded: '9007199254740991', counted: '0' },
    { sku: 'B', recorded: '9007199254740991', counted: '0' },
    { sku: 'C', recorded: '0', counted: '9007199254740991' }
  ];
  const result = summarizeStockSnapshot(rows);
  assert.equal(result.shortageUnits, '18014398509481982');
  assert.equal(result.surplusUnits, '9007199254740991');
  assert.equal(result.netDifferenceUnits, '-9007199254740991');
  assert.deepEqual(summarizeStockSnapshot([...rows].reverse()), result);
});

test('P0-06 aggregate: invalid duplicate SKU or malformed count fails atomically', () => {
  assert.throws(() => summarizeStockSnapshot([
    { sku: 'A', recorded: '1', counted: '0' },
    { sku: 'A', recorded: '2', counted: '1' }
  ]), /Duplicate SKU/);
  assert.throws(() => summarizeStockSnapshot([
    { sku: 'A', recorded: '1', counted: '0' },
    { sku: 'B', recorded: '2', counted: '-1' }
  ]), TypeError);
});
