'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

test('P0-06: invisible and bidirectional SKU controls cannot alias inventory identities', () => {
  const forbidden = ['\u200b', '\u200c', '\u200d', '\u200e', '\u200f', '\u202a', '\u202b', '\u202c', '\u202d', '\u202e', '\u2060', '\u2066', '\u2067', '\u2068', '\u2069', '\ufeff'];
  for (const character of forbidden) {
    assert.throws(
      () => reconcileStockSnapshot([{ sku: 'SKU' + character + '1', recorded: '1', counted: '2' }]),
      TypeError,
      'must reject U+' + character.codePointAt(0).toString(16)
    );
  }
  const valid = reconcileStockSnapshot([{ sku: 'SKU-1', recorded: '1', counted: '2' }]);
  assert.equal(valid[0].differenceUnits, '1');
  assert.equal(Object.isFrozen(valid), true);
});
