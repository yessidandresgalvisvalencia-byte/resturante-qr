'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

// Plan Maestro 06: reject invisible identifiers before inventory matching.
test('P0-06 rejects default-ignorable Unicode SKU without mutating stock', () => {
  for (const hidden of ['\u00ad', '\u180e', '\u200b', '\u2060', '\ufe0f', '\u{e0100}']) {
    const row = Object.freeze({ sku: 'ITEM' + hidden, recorded: '2', counted: '1' });
    assert.throws(() => reconcileStockSnapshot([row]), /canonical identifier/);
    assert.equal(row.recorded, '2');
  }
});

test('P0-06 retains normalized multilingual visible SKU', () => {
  const rows = [{ sku: 'CAFÉ-東京', recorded: '3', counted: '2' }];
  assert.equal(reconcileStockSnapshot(rows)[0].differenceUnits, '-1');
});
