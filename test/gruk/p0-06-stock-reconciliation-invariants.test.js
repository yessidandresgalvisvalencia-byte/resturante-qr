'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStock, reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

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

test('P0-06: reject non-ASCII numerals, invisible characters and unsafe 16-digit bounds', () => {
  const malformed = ['０', '١', '１', '1\u200b', '\u200b1', '1\n', ' 1', '+1', '00', '0001', '0x10', '1_000'];
  for (const value of malformed) {
    assert.throws(() => reconcileStock(value, '0'), TypeError, JSON.stringify(value));
    assert.throws(() => reconcileStock('0', value), TypeError, JSON.stringify(value));
  }
  assert.throws(() => reconcileStock('9999999999999999', '0'), RangeError);
  assert.throws(() => reconcileStock('0', '9999999999999999'), RangeError);
  assert.equal(reconcileStock('9007199254740991', '9007199254740991').matches, true);
});

test('P0-06: reject non-string values without coercion or invoking user code', () => {
  let invoked = 0;
  const hostile = {
    toString() { invoked++; throw new Error('must not coerce'); },
    valueOf() { invoked++; throw new Error('must not coerce'); },
    [Symbol.toPrimitive]() { invoked++; throw new Error('must not coerce'); }
  };
  const invalid = [null, undefined, 0, 1, 1n, false, true, NaN, Infinity,
    [], ['1'], hostile, Symbol('quantity')];
  for (const value of invalid) {
    assert.throws(() => reconcileStock(value, '0'), TypeError);
    assert.throws(() => reconcileStock('0', value), TypeError);
  }
  assert.equal(invoked, 0);
});

test('P0-06: exhaustive small-stock reconciliation conserves signed units', () => {
  for (let recorded = 0; recorded <= 32; recorded++) {
    for (let counted = 0; counted <= 32; counted++) {
      const result = reconcileStock(String(recorded), String(counted));
      const delta = counted - recorded;
      assert.deepEqual(result, {
        matches: delta === 0,
        differenceUnits: String(delta),
        absoluteDifferenceUnits: String(Math.abs(delta))
      }, `recorded=${recorded} counted=${counted}`);
      assert.equal(Object.isFrozen(result), true);
    }
  }
});

test('P0-06: snapshot row order does not change SKU reconciliation and inputs remain untouched', () => {
  const rows = Object.freeze([
    Object.freeze({ sku: 'A', recorded: '9007199254740991', counted: '0' }),
    Object.freeze({ sku: 'B', recorded: '0', counted: '9007199254740991' }),
    Object.freeze({ sku: 'C', recorded: '5', counted: '5' })
  ]);
  const forward = reconcileStockSnapshot(rows);
  const reverse = reconcileStockSnapshot(Object.freeze([...rows].reverse()));
  const bySku = snapshot => Object.fromEntries(snapshot.map(({ sku, ...result }) => [sku, result]));
  assert.deepEqual(bySku(forward), bySku(reverse));
  assert.equal(forward[0].differenceUnits, '-9007199254740991');
  assert.equal(forward[1].differenceUnits, '9007199254740991');
  assert.equal(forward[2].matches, true);
  assert.equal(Object.isFrozen(forward), true);
  assert.ok(forward.every(Object.isFrozen));
  assert.deepEqual(rows.map(row => row.sku), ['A', 'B', 'C']);
});
