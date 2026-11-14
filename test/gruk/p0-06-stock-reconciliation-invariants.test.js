'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStock } = require('../../core/inventory/enterpriseStockReconciliation');

// Plan Maestro 06 [P0]: read-only reconciliation invariants, not acceptance certification.
test('P0-06: reversing physical and recorded stock reverses signed delta', () => {
  const pairs = [['0', '0'], ['0', '1'], ['1', '0'], ['2', '9'],
    ['9007199254740991', '0'], ['0', '9007199254740991'],
    ['9007199254740991', '9007199254740990']];
  for (const [recorded, counted] of pairs) {
    const forward = reconcileStock(recorded, counted);
    const reverse = reconcileStock(counted, recorded);
    assert.equal(BigInt(forward.differenceUnits), -BigInt(reverse.differenceUnits));
    assert.equal(forward.absoluteDifferenceUnits, reverse.absoluteDifferenceUnits);
    assert.equal(forward.matches, recorded === counted);
  }
});

test('P0-06: exact delta matches counted minus recorded at safe boundaries', () => {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  for (const [recorded, counted] of [['0', '0'], ['1', '1'],
    ['0', max.toString()], [max.toString(), '0'],
    [max.toString(), (max - 1n).toString()]]) {
    const result = reconcileStock(recorded, counted);
    const delta = BigInt(counted) - BigInt(recorded);
    assert.equal(result.differenceUnits, delta.toString());
    assert.equal(result.absoluteDifferenceUnits, (delta < 0n ? -delta : delta).toString());
    assert.equal(Object.isFrozen(result), true);
  }
});
