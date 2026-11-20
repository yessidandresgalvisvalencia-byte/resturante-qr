'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  reconcileTenantStockSnapshot,
  summarizeTenantStockSnapshot
} = require('../../core/inventory/enterpriseStockTenantScope');

// Plan Maestro P0-06: isolated, read-only tenant/site reconciliation evidence.
// This does not establish user authorization, persistence, or E2E acceptance.
const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const SITE = 'cccccccccccccccccccccccc';
const OTHER_SITE = 'dddddddddddddddddddddddd';
const row = (sku, recorded, counted, empresaId = A, sedeId = SITE) =>
  Object.freeze({ empresaId, sedeId, sku, recorded, counted });
const request = rows => Object.freeze({ empresaId: A, sedeId: SITE, rows: Object.freeze(rows) });

test('P0-06 tenant summary conserves exact units beyond Number safe aggregate', () => {
  const input = request([
    row('MAX-A', '9007199254740991', '0'),
    row('MAX-B', '9007199254740991', '0'),
    row('MAX-C', '0', '9007199254740991'),
    row('MATCH', '1', '1')
  ]);
  const before = JSON.stringify(input);
  const result = summarizeTenantStockSnapshot(input);
  assert.deepEqual(result, {
    totalSkus: 4,
    matchedSkus: 1,
    mismatchedSkus: 3,
    shortageUnits: '18014398509481982',
    surplusUnits: '9007199254740991',
    netDifferenceUnits: '-9007199254740991'
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(JSON.stringify(input), before);
});

test('P0-06 tenant boundary rejects cross-company and cross-site rows atomically', () => {
  for (const hostile of [
    row('FOREIGN-COMPANY', '0', '1', B, SITE),
    row('FOREIGN-SITE', '0', '1', A, OTHER_SITE)
  ]) {
    const input = request([row('VALID', '1', '2'), hostile]);
    assert.throws(() => reconcileTenantStockSnapshot(input), /Cross-tenant or cross-site/);
    assert.throws(() => summarizeTenantStockSnapshot(input), /Cross-tenant or cross-site/);
  }
});

test('P0-06 tenant boundary rejects accessors without executing side effects', () => {
  let calls = 0;
  const malicious = { empresaId: A, sedeId: SITE, sku: 'X', counted: '1' };
  Object.defineProperty(malicious, 'recorded', {
    enumerable: true,
    get() { calls++; throw new Error('getter executed'); }
  });
  const input = request([malicious]);
  assert.throws(() => reconcileTenantStockSnapshot(input), /Missing own data property/);
  assert.throws(() => summarizeTenantStockSnapshot(input), /Missing own data property/);
  assert.equal(calls, 0);
});

test('P0-06 duplicate SKU is rejected even when counts are identical', () => {
  const input = request([row('SKU', '2', '2'), row('SKU', '2', '2')]);
  assert.throws(() => reconcileTenantStockSnapshot(input), /Duplicate SKU/);
  assert.throws(() => summarizeTenantStockSnapshot(input), /Duplicate SKU/);
});
