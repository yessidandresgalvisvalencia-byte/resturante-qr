'use strict';

// P0-06: pure tenant/sede boundary for read-only stock snapshots.
// Does not authorize a user or query a database: the caller must do both.
const { types: { isProxy } } = require('node:util');
const { reconcileStockSnapshot } = require('./enterpriseStockReconciliation');
const HEX_ID = /^[a-f0-9]{24}$/;
function canonicalId(value, name) {
  if (typeof value !== 'string' || !HEX_ID.test(value)) {
    throw new TypeError(name + ' must be a canonical lowercase ObjectId string');
  }
  return value;
}
function ownData(object, key) {
  if (isProxy(object)) throw new TypeError('Proxies are not allowed');
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    throw new TypeError('Expected a plain stock record');
  }
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
    throw new TypeError('Missing own data property: ' + key);
  }
  return descriptor.value;
}
function reconcileTenantStockSnapshot({ empresaId, sedeId, rows }) {
  const tenant = canonicalId(empresaId, 'empresaId');
  const site = canonicalId(sedeId, 'sedeId');
  if (isProxy(rows) || !Array.isArray(rows) || rows.length > 10000) {
    throw new TypeError('Invalid stock snapshot');
  }
  const sanitized = [];
  for (let i = 0; i < rows.length; i++) {
    const slot = Object.getOwnPropertyDescriptor(rows, String(i));
    if (!slot || !Object.hasOwn(slot, 'value')) throw new TypeError('Sparse or accessor stock snapshot');
    const row = slot.value;
    if (canonicalId(ownData(row, 'empresaId'), 'row.empresaId') !== tenant ||
        canonicalId(ownData(row, 'sedeId'), 'row.sedeId') !== site) {
      throw new Error('Cross-tenant or cross-site stock snapshot rejected');
    }
    sanitized.push(Object.freeze({
      sku: ownData(row, 'sku'),
      recorded: ownData(row, 'recorded'),
      counted: ownData(row, 'counted')
    }));
  }
  // Validate the entire snapshot atomically; never return partial results.
  return reconcileStockSnapshot(sanitized);
}
module.exports = { reconcileTenantStockSnapshot };
