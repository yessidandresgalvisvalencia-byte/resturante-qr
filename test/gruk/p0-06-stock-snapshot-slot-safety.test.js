'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

const row = (sku) => ({ sku, recorded: '2', counted: '3' });

test('P0-06: snapshot index getter is never invoked', () => {
  const rows = [row('A')];
  let invoked = 0;
  Object.defineProperty(rows, '0', { enumerable: true, configurable: true, get() {
    invoked += 1;
    throw new Error('index getter executed');
  } });
  assert.throws(() => reconcileStockSnapshot(rows), /own data elements/);
  assert.equal(invoked, 0);
});

test('P0-06: inherited array slots cannot enter reconciliation', () => {
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, '0', { configurable: true, value: row('INHERITED') });
  const rows = new Array(1);
  Object.setPrototypeOf(rows, prototype);
  assert.throws(() => reconcileStockSnapshot(rows), /own data elements/);
});

test('P0-06: own frozen snapshot slots reconcile deterministically', () => {
  const rows = Object.freeze([Object.freeze(row('A')), Object.freeze(row('B'))]);
  const result = reconcileStockSnapshot(rows);
  assert.deepEqual(result.map(x => x.differenceUnits), ['1', '1']);
  assert.ok(Object.isFrozen(result));
  assert.ok(result.every(Object.isFrozen));
});
