'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStock } = require('../../core/inventory/enterpriseStockReconciliation');

test('P0-06: exact matching and signed shortages or surplus', () => {
  assert.deepEqual(reconcileStock('10', '10'), { matches: true, differenceUnits: '0', absoluteDifferenceUnits: '0' });
  assert.deepEqual(reconcileStock('10', '7'), { matches: false, differenceUnits: '-3', absoluteDifferenceUnits: '3' });
  assert.deepEqual(reconcileStock('7', '10'), { matches: false, differenceUnits: '3', absoluteDifferenceUnits: '3' });
});
test('P0-06: exact integer boundaries without Number conversion', () => {
  assert.equal(reconcileStock('9007199254740991', '0').differenceUnits, '-9007199254740991');
  assert.throws(() => reconcileStock('9007199254740992', '0'), RangeError);
});
test('P0-06: reject ambiguous, negative, malformed or oversized quantities', () => {
  for (const invalid of [1, 1.5, null, '-1', '01', '1.0', '1e3', '', '9'.repeat(100000)]) {
    assert.throws(() => reconcileStock(invalid, '0'));
    assert.throws(() => reconcileStock('0', invalid));
  }
});

test('P0-06: pure and immutable results under repeated and hostile inputs', () => {
  const first = reconcileStock('0', '9007199254740991');
  assert.deepEqual(first, { matches: false, differenceUnits: '9007199254740991', absoluteDifferenceUnits: '9007199254740991' });
  assert.equal(Object.isFrozen(first), true);
  assert.throws(() => { first.differenceUnits = '0'; }, TypeError);
  assert.deepEqual(reconcileStock('0', '9007199254740991'), first);
  const hostile = { toString() { throw new Error('must not coerce'); } };
  assert.throws(() => reconcileStock(hostile, '0'), TypeError);
  assert.throws(() => reconcileStock('0', hostile), TypeError);
});
