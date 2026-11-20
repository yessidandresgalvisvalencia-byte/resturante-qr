'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

test('P0-06: reject actual ASCII control characters in stock identifiers', () => {
  for (let code = 0; code <= 31; code++) {
    const sku = 'ITEM' + String.fromCharCode(code) + '001';
    assert.throws(() => reconcileStockSnapshot([{ sku, recorded: '1', counted: '1' }]), TypeError, 'control ' + code);
  }
  assert.throws(() => reconcileStockSnapshot([{ sku: 'ITEM\x7f001', recorded: '1', counted: '1' }]), TypeError);
});

test('P0-06: valid bounded SKUs retain exact read-only reconciliation', () => {
  const rows = [{ sku: 'ITEM-001', recorded: '9007199254740991', counted: '0' }];
  const result = reconcileStockSnapshot(rows);
  assert.deepEqual(result, [{ sku: 'ITEM-001', matches: false, differenceUnits: '-9007199254740991', absoluteDifferenceUnits: '9007199254740991' }]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result[0]), true);
  assert.deepEqual(rows, [{ sku: 'ITEM-001', recorded: '9007199254740991', counted: '0' }]);
});
