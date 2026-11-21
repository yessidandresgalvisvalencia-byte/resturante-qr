'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStock } = require('../../core/inventory/enterpriseStockReconciliation');

// Plan Maestro P0-06: adversarial boundary tests for the read-only primitive.
// These are NOT evidence of persistence, tenant authorization or E2E acceptance.
test('P0-06: reject oversized attacker-controlled quantities before BigInt parsing', () => {
  const huge = '9'.repeat(1_000_000);
  assert.throws(() => reconcileStock(huge, '0'), TypeError);
  assert.throws(() => reconcileStock('0', huge), TypeError);
  assert.equal(reconcileStock('0', '0').matches, true);
});

test('P0-06: input validation is atomic and never mutates caller-owned values', () => {
  const recorded = Object.freeze({ quantity: '12' });
  const counted = Object.freeze({ quantity: '9' });
  assert.throws(() => reconcileStock(recorded, counted), TypeError);
  assert.deepEqual(recorded, { quantity: '12' });
  assert.deepEqual(counted, { quantity: '9' });
  const output = reconcileStock(recorded.quantity, counted.quantity);
  assert.deepEqual(output, { matches: false, differenceUnits: '-3', absoluteDifferenceUnits: '3' });
  assert.equal(Object.isFrozen(output), true);
});
