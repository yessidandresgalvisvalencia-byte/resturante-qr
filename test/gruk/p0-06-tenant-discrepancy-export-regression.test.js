'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { tenantStockDiscrepancyReport } = require('../../core/inventory/enterpriseTenantStockDiscrepancyReport');

const empresaId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const sedeId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const otherEmpresa = 'cccccccccccccccccccccccc';
const row = (sku, recorded, counted, overrides = {}) =>
  ({ empresaId, sedeId, sku, recorded, counted, ...overrides });
const request = rows => ({ empresaId, sedeId, rows });

test('P0-06 tenant report aggregates exact values and sorts discrepancies without mutation', () => {
  const rows = Object.freeze([
    Object.freeze(row('Z', '9007199254740991', '0')),
    Object.freeze(row('A', '0', '9007199254740991')),
    Object.freeze(row('M', '3', '3'))
  ]);
  const result = tenantStockDiscrepancyReport(request(rows));
  assert.equal(result.totalSkus, 3);
  assert.equal(result.mismatchedSkus, 2);
  assert.equal(result.shortageUnits, '9007199254740991');
  assert.equal(result.surplusUnits, '9007199254740991');
  assert.equal(result.netDifferenceUnits, '0');
  assert.deepEqual(result.differences.map(x => x.sku), ['A', 'Z']);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.differences));
  assert.ok(result.differences.every(Object.isFrozen));
  assert.deepEqual(rows.map(x => x.sku), ['Z', 'A', 'M']);
});

test('P0-06 tenant report rejects mixed-company and mixed-site snapshots atomically', () => {
  assert.throws(() => tenantStockDiscrepancyReport(request([
    row('A', '1', '0'), row('B', '1', '0', { empresaId: otherEmpresa })
  ])), /Cross-tenant or cross-site/);
  assert.throws(() => tenantStockDiscrepancyReport(request([
    row('A', '1', '0'), row('B', '1', '0', { sedeId: otherEmpresa })
  ])), /Cross-tenant or cross-site/);
});

test('P0-06 tenant report rejects accessor rows without executing getters', () => {
  let called = 0;
  const hostile = row('B', '1', '0');
  Object.defineProperty(hostile, 'counted', { enumerable: true, get() { called++; throw Error('unsafe'); } });
  assert.throws(() => tenantStockDiscrepancyReport(request([
    row('A', '1', '0'), hostile
  ])), TypeError);
  assert.equal(called, 0);
});

test('P0-06 tenant report rejects duplicate SKUs and keeps empty snapshots deterministic', () => {
  assert.throws(() => tenantStockDiscrepancyReport(request([
    row('A', '1', '0'), row('A', '2', '1')
  ])), /Duplicate SKU/);
  assert.deepEqual(tenantStockDiscrepancyReport(request([])), {
    totalSkus: 0, mismatchedSkus: 0,
    shortageUnits: '0', surplusUnits: '0',
    netDifferenceUnits: '0', differences: []
  });
});
