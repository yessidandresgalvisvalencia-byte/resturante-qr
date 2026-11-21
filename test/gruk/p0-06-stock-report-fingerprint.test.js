'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { tenantStockReportFingerprint } = require('../../core/inventory/enterpriseStockReportFingerprint');
const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const C = 'cccccccccccccccccccccccc';
const row = (sku, recorded, counted, empresaId=A, sedeId=B) => ({ sku, recorded, counted, empresaId, sedeId });
const request = (rows, empresaId=A, sedeId=B) => ({ empresaId, sedeId, rows });

test('fingerprint is stable across stock-row order and returns immutable report', () => {
  const rows = [row('Z', '5', '3'), row('A', '1', '2')];
  const first = tenantStockReportFingerprint(request(rows));
  const second = tenantStockReportFingerprint(request([...rows].reverse()));
  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.equal(first.digest, second.digest);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.report));
  assert.ok(Object.isFrozen(first.report.differences));
});

test('fingerprint is bound to company and site even with identical discrepancies', () => {
  const base = tenantStockReportFingerprint(request([row('A', '1', '2')]));
  const site = tenantStockReportFingerprint(request([row('A', '1', '2', A, C)], A, C));
  const tenant = tenantStockReportFingerprint(request([row('A', '1', '2', C, B)], C, B));
  assert.notEqual(base.digest, site.digest);
  assert.notEqual(base.digest, tenant.digest);
});

test('cross-tenant rows reject atomically without returning a fingerprint', () => {
  assert.throws(() => tenantStockReportFingerprint(request([
    row('A', '1', '2'), row('B', '1', '2', C, B)
  ])), /Cross-tenant/);
});

test('request getters are not invoked by the fingerprint boundary', () => {
  let invoked = 0;
  const req = request([row('A', '1', '2')]);
  Object.defineProperty(req, 'empresaId', { enumerable: true, get() { invoked++; return A; } });
  assert.throws(() => tenantStockReportFingerprint(req), /own data property|own data/);
  assert.equal(invoked, 0);
});
