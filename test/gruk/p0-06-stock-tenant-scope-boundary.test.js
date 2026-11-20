'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileTenantStockSnapshot, summarizeTenantStockSnapshot } = require('../../core/inventory/enterpriseStockTenantScope');
const empresaId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const sedeId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const row = () => ({ empresaId, sedeId, sku: 'SKU-1', recorded: '2', counted: '3' });

test('P0-06 request accessors are rejected without invoking side effects', () => {
  for (const key of ['empresaId', 'sedeId', 'rows']) {
    let invoked = 0;
    const request = { empresaId, sedeId, rows: [row()] };
    Object.defineProperty(request, key, { enumerable: true, get() { invoked++; throw Error('side effect'); } });
    assert.throws(() => reconcileTenantStockSnapshot(request), TypeError);
    assert.throws(() => summarizeTenantStockSnapshot(request), TypeError);
    assert.equal(invoked, 0);
  }
});

test('P0-06 inherited request fields cannot select tenant or site', () => {
  for (const key of ['empresaId', 'sedeId', 'rows']) {
    const request = { empresaId, sedeId, rows: [row()] };
    const value = request[key];
    delete request[key];
    const inherited = Object.assign(Object.create({ [key]: value }), request);
    assert.throws(() => reconcileTenantStockSnapshot(inherited), TypeError);
  }
});

test('P0-06 array index accessors cannot execute during reconciliation', () => {
  let invoked = 0;
  const rows = [row()];
  Object.defineProperty(rows, '0', { get() { invoked++; throw Error('side effect'); } });
  assert.throws(() => reconcileTenantStockSnapshot({ empresaId, sedeId, rows }), TypeError);
  assert.equal(invoked, 0);
});

test('P0-06 tenant boundary permits empty snapshots with exact zero totals', () => {
  const request = { empresaId, sedeId, rows: [] };
  assert.deepEqual(reconcileTenantStockSnapshot(request), []);
  assert.deepEqual(summarizeTenantStockSnapshot(request), {
    totalSkus: 0, matchedSkus: 0, mismatchedSkus: 0,
    shortageUnits: '0', surplusUnits: '0', netDifferenceUnits: '0'
  });
});

test('P0-06 tenant boundary rejects oversized snapshots before reading rows', () => {
  const rows = new Array(10001);
  let invoked = 0;
  Object.defineProperty(rows, '0', { get() { invoked++; throw Error('side effect'); } });
  assert.throws(() => reconcileTenantStockSnapshot({ empresaId, sedeId, rows }), TypeError);
  assert.equal(invoked, 0);
});
