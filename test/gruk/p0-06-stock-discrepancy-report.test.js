'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { stockDiscrepancyReport } = require('../../core/inventory/enterpriseStockDiscrepancyReport');

test('P0-06 report: stable SKU ordering, exact totals and frozen differences', () => {
  const rows = Object.freeze([
    Object.freeze({ sku: 'Z', recorded: '9007199254740991', counted: '0' }),
    Object.freeze({ sku: 'M', recorded: '2', counted: '2' }),
    Object.freeze({ sku: 'A', recorded: '0', counted: '9007199254740991' })
  ]);
  const report = stockDiscrepancyReport(rows);
  assert.deepEqual(report.differences.map(x => x.sku), ['A', 'Z']);
  assert.equal(report.totalSkus, 3);
  assert.equal(report.mismatchedSkus, 2);
  assert.equal(report.shortageUnits, '9007199254740991');
  assert.equal(report.surplusUnits, '9007199254740991');
  assert.equal(report.netDifferenceUnits, '0');
  assert.deepEqual(stockDiscrepancyReport([...rows].reverse()), report);
  assert.ok(Object.isFrozen(report) && Object.isFrozen(report.differences));
  assert.ok(report.differences.every(Object.isFrozen));
  assert.equal(rows[0].recorded, '9007199254740991');
});

test('P0-06 report: empty and matched snapshots have no differences', () => {
  assert.deepEqual(stockDiscrepancyReport([]), {
    totalSkus: 0, mismatchedSkus: 0, shortageUnits: '0',
    surplusUnits: '0', netDifferenceUnits: '0', differences: []
  });
  assert.equal(stockDiscrepancyReport([{ sku: 'A', recorded: '4', counted: '4' }]).differences.length, 0);
});

test('P0-06 report: invalid duplicate, getter and proxy inputs fail without execution', () => {
  assert.throws(() => stockDiscrepancyReport([
    { sku: 'A', recorded: '1', counted: '0' },
    { sku: 'A', recorded: '1', counted: '0' }
  ]), /Duplicate SKU/);
  let calls = 0;
  const row = { sku: 'A', recorded: '1' };
  Object.defineProperty(row, 'counted', { enumerable: true, get() { calls++; return '1'; } });
  assert.throws(() => stockDiscrepancyReport([row]), TypeError);
  assert.equal(calls, 0);
  assert.throws(() => stockDiscrepancyReport(new Proxy([], {})), TypeError);
});
