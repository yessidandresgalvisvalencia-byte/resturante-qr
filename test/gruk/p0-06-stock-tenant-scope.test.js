'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileTenantStockSnapshot } = require('../../core/inventory/enterpriseStockTenantScope');
const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const S = 'cccccccccccccccccccccccc';
const T = 'dddddddddddddddddddddddd';
const row = (overrides = {}) => ({ empresaId: A, sedeId: S, sku: 'SKU-1', recorded: '7', counted: '4', ...overrides });

test('P0-06 tenant snapshot: reconciles only exact empresa and sede, without mutation', () => {
  const original = Object.freeze(row());
  const rows = Object.freeze([original]);
  const result = reconcileTenantStockSnapshot({ empresaId: A, sedeId: S, rows });
  assert.equal(result[0].differenceUnits, '-3');
  assert.equal(result[0].sku, 'SKU-1');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result[0]), true);
  assert.equal(original.recorded, '7');
});

test('P0-06 tenant snapshot: rejects mixed company or site atomically', () => {
  for (const other of [{ empresaId: B }, { sedeId: T }, { empresaId: null }, { sedeId: undefined }]) {
    assert.throws(() => reconcileTenantStockSnapshot({
      empresaId: A, sedeId: S, rows: [row(), row({ sku: 'SKU-2', ...other })]
    }));
  }
  assert.throws(() => reconcileTenantStockSnapshot({ empresaId: A.toUpperCase(), sedeId: S, rows: [] }), TypeError);
  assert.throws(() => reconcileTenantStockSnapshot({ empresaId: A, sedeId: null, rows: [] }), TypeError);
});

test('P0-06 tenant snapshot: rejects getters, proxies and sparse slots without invoking user code', () => {
  let called = 0;
  const getter = row();
  Object.defineProperty(getter, 'empresaId', { enumerable: true, get() { called++; throw Error('executed'); } });
  assert.throws(() => reconcileTenantStockSnapshot({ empresaId: A, sedeId: S, rows: [getter] }), TypeError);
  assert.throws(() => reconcileTenantStockSnapshot({ empresaId: A, sedeId: S, rows: [new Proxy(row(), {})] }), TypeError);
  const sparse = new Array(1);
  assert.throws(() => reconcileTenantStockSnapshot({ empresaId: A, sedeId: S, rows: sparse }), TypeError);
  assert.equal(called, 0);
});

test('P0-06 tenant snapshot: invalid quantities and duplicate SKUs never produce partial results', () => {
  assert.throws(() => reconcileTenantStockSnapshot({
    empresaId: A, sedeId: S, rows: [row(), row({ sku: 'SKU-2', counted: '-1' })]
  }), TypeError);
  assert.throws(() => reconcileTenantStockSnapshot({
    empresaId: A, sedeId: S, rows: [row(), row()]
  }), TypeError);
});

test('P0-06 tenant summary: exact signed totals and frozen output', () => {
  const { summarizeTenantStockSnapshot } = require('../../core/inventory/enterpriseStockTenantScope');
  const input = Object.freeze([
    Object.freeze(row({ sku: 'A', recorded: '9007199254740991', counted: '0' })),
    Object.freeze(row({ sku: 'B', recorded: '0', counted: '9007199254740991' })),
    Object.freeze(row({ sku: 'C', recorded: '1', counted: '1' }))
  ]);
  const summary = summarizeTenantStockSnapshot({ empresaId: A, sedeId: S, rows: input });
  assert.deepEqual(summary, {
    totalSkus: 3, matchedSkus: 1, mismatchedSkus: 2,
    shortageUnits: '9007199254740991', surplusUnits: '9007199254740991',
    netDifferenceUnits: '0'
  });
  assert.ok(Object.isFrozen(summary));
});

test('P0-06 tenant summary: rejects mixed company/site and accessors before aggregation', () => {
  const { summarizeTenantStockSnapshot } = require('../../core/inventory/enterpriseStockTenantScope');
  for (const foreign of [{ empresaId: B }, { sedeId: T }]) {
    assert.throws(() => summarizeTenantStockSnapshot({
      empresaId: A, sedeId: S, rows: [row(), row({ sku: 'OTHER', ...foreign })]
    }), /Cross-tenant or cross-site/);
  }
  let called = 0;
  const evil = row({ sku: 'OTHER' });
  Object.defineProperty(evil, 'counted', { get() { called++; return '1'; } });
  assert.throws(() => summarizeTenantStockSnapshot({
    empresaId: A, sedeId: S, rows: [row(), evil]
  }), TypeError);
  assert.equal(called, 0);
});
