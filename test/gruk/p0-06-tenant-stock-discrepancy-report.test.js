'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { tenantStockDiscrepancyReport } = require('../../core/inventory/enterpriseTenantStockDiscrepancyReport');
const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const row = (sku, recorded, counted, empresaId = A, sedeId = B) =>
  Object.freeze({ sku, recorded, counted, empresaId, sedeId });
const request = rows => Object.freeze({ empresaId: A, sedeId: B, rows: Object.freeze(rows) });

test('P0-06 scoped report is exact, stable, immutable and omits matching rows', () => {
  const rows = [
    row('Z', '9007199254740991', '0'),
    row('A', '0', '9007199254740991'),
    row('M', '4', '4')
  ];
  const report = tenantStockDiscrepancyReport(request(rows));
  assert.deepEqual(report.differences.map(x => x.sku), ['A', 'Z']);
  assert.equal(report.totalSkus, 3);
  assert.equal(report.mismatchedSkus, 2);
  assert.equal(report.shortageUnits, '9007199254740991');
  assert.equal(report.surplusUnits, '9007199254740991');
  assert.equal(report.netDifferenceUnits, '0');
  assert.deepEqual(tenantStockDiscrepancyReport(request([...rows].reverse())), report);
  assert.ok(Object.isFrozen(report) && Object.isFrozen(report.differences));
  assert.ok(report.differences.every(Object.isFrozen));
  assert.equal(rows[0].recorded, '9007199254740991');
});

test('P0-06 scoped report rejects cross-tenant and cross-site rows atomically', () => {
  for (const invalid of [row('X', '1', '0', B, B), row('X', '1', '0', A, A)]) {
    assert.throws(() => tenantStockDiscrepancyReport(request([
      row('OK', '1', '0'), invalid
    ])), /Cross-tenant or cross-site/);
  }
});

test('P0-06 scoped report rejects getters without executing them', () => {
  let called = 0;
  const malicious = { empresaId: A, sedeId: B, sku: 'X', recorded: '1' };
  Object.defineProperty(malicious, 'counted', { get() { called++; throw Error('executed'); } });
  assert.throws(() => tenantStockDiscrepancyReport(request([malicious])), /own data property/);
  assert.equal(called, 0);
});

test('P0-06 scoped report handles empty snapshot and rejects duplicate SKU', () => {
  assert.deepEqual(tenantStockDiscrepancyReport(request([])), {
    totalSkus: 0, mismatchedSkus: 0, shortageUnits: '0',
    surplusUnits: '0', netDifferenceUnits: '0', differences: []
  });
  assert.throws(() => tenantStockDiscrepancyReport(request([
    row('X', '1', '1'), row('X', '1', '0')
  ])), /Duplicate SKU/);
});
