'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileTenantStockSnapshot } = require('../../core/inventory/enterpriseStockTenantScope');

const empresaId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const sedeId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const row = Object.freeze({ empresaId, sedeId, sku: 'ITEM', recorded: '3', counted: '2' });

test('P0-06 rejects request accessors without invoking them', () => {
  for (const field of ['empresaId', 'sedeId', 'rows']) {
    let calls = 0;
    const request = { empresaId, sedeId, rows: [row] };
    Object.defineProperty(request, field, { get() { calls++; throw Error('getter executed'); } });
    assert.throws(() => reconcileTenantStockSnapshot(request), /own data property/);
    assert.equal(calls, 0);
  }
});

test('P0-06 rejects proxy requests without invoking traps', () => {
  let calls = 0;
  const request = new Proxy({ empresaId, sedeId, rows: [row] }, {
    get() { calls++; throw Error('proxy executed'); },
    getOwnPropertyDescriptor() { calls++; throw Error('proxy executed'); }
  });
  assert.throws(() => reconcileTenantStockSnapshot(request), /Proxies are not allowed/);
  assert.equal(calls, 0);
});

test('P0-06 accepts own-data tenant requests and rejects foreign site atomically', () => {
  const valid = Object.freeze({ empresaId, sedeId, rows: [row] });
  const result = reconcileTenantStockSnapshot(valid);
  assert.equal(result[0].differenceUnits, '-1');
  assert.ok(Object.isFrozen(result));
  assert.throws(() => reconcileTenantStockSnapshot({
    empresaId, sedeId, rows: [row, { ...row, sedeId: 'cccccccccccccccccccccccc' }]
  }), /Cross-tenant or cross-site/);
});
