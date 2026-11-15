'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

// P0-06: proxies can execute traps even when no property getters are read.
test('P0-06 rejects proxy arrays without executing length or descriptor traps', () => {
  let calls = 0;
  const proxy = new Proxy([{ sku: 'A', recorded: '1', counted: '2' }], {
    get() { calls++; throw Error('proxy get executed'); },
    getOwnPropertyDescriptor() { calls++; throw Error('proxy descriptor executed'); }
  });
  assert.throws(() => reconcileStockSnapshot(proxy), /proxies are not allowed/);
  assert.equal(calls, 0);
});

test('P0-06 rejects proxy rows without executing own-field or descriptor traps', () => {
  let calls = 0;
  const proxy = new Proxy({ sku: 'A', recorded: '1', counted: '2' }, {
    getOwnPropertyDescriptor() { calls++; throw Error('proxy descriptor executed'); },
    get() { calls++; throw Error('proxy get executed'); }
  });
  assert.throws(() => reconcileStockSnapshot([proxy]), /proxies are not allowed/);
  assert.equal(calls, 0);
});

test('P0-06 rejects revoked proxies without invoking traps', () => {
  const row = Proxy.revocable({ sku: 'A', recorded: '1', counted: '2' }, {});
  row.revoke();
  assert.throws(() => reconcileStockSnapshot([row.proxy]), /proxies are not allowed/);
  const snapshot = Proxy.revocable([], {});
  snapshot.revoke();
  assert.throws(() => reconcileStockSnapshot(snapshot.proxy), /proxies are not allowed/);
});
