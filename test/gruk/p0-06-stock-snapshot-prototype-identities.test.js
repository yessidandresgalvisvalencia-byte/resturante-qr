'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

// Plan Maestro P0-06: adversarial SKU identities and exact stock boundaries.
// Pure unit evidence only; tenant authorization and persistence remain unverified.
test('P0-06: prototype-like SKU identifiers remain data, not object keys', () => {
  const rows = Object.freeze([
    Object.freeze({ sku: '__proto__', recorded: '0', counted: '1' }),
    Object.freeze({ sku: 'constructor', recorded: '2', counted: '0' }),
    Object.freeze({ sku: 'toString', recorded: '3', counted: '3' })
  ]);
  const result = reconcileStockSnapshot(rows);
  assert.deepEqual(result.map(row => [row.sku, row.differenceUnits]), [
    ['__proto__', '1'], ['constructor', '-2'], ['toString', '0']
  ]);
  assert.equal(Object.isFrozen(result), true);
  assert.ok(result.every(Object.isFrozen));
  assert.equal(Object.prototype.polluted, undefined);
});

test('P0-06: duplicate prototype-like SKU fails without changing frozen input', () => {
  const rows = Object.freeze([
    Object.freeze({ sku: '__proto__', recorded: '1', counted: '2' }),
    Object.freeze({ sku: '__proto__', recorded: '2', counted: '1' })
  ]);
  assert.throws(() => reconcileStockSnapshot(rows), /Duplicate SKU/);
  assert.equal(rows[0].recorded, '1');
  assert.equal(rows[1].counted, '1');
});

test('P0-06: snapshot reconciles both safe-integer endpoints exactly', () => {
  const max = String(Number.MAX_SAFE_INTEGER);
  const result = reconcileStockSnapshot([
    { sku: 'MAX-LOSS', recorded: max, counted: '0' },
    { sku: 'MAX-GAIN', recorded: '0', counted: max }
  ]);
  assert.deepEqual(result.map(row => row.differenceUnits), [
    '-' + max, max
  ]);
  assert.deepEqual(result.map(row => row.absoluteDifferenceUnits), [max, max]);
});
