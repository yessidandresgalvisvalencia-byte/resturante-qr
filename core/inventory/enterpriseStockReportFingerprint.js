'use strict';

// P0-06: content-addressed evidence for an authorized, read-only stock report.
// This is NOT an audit-log write, signature, authorization check or correction.
const { createHash } = require('node:crypto');
const { types: { isProxy } } = require('node:util');
const { tenantStockDiscrepancyReport } = require('./enterpriseTenantStockDiscrepancyReport');

function ownData(object, key) {
  if (isProxy(object) || !object || typeof object !== 'object' || Array.isArray(object)) {
    throw new TypeError('Expected plain request');
  }
  const proto = Object.getPrototypeOf(object);
  if (proto !== Object.prototype && proto !== null) throw new TypeError('Expected plain request');
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Missing own data: ' + key);
  return descriptor.value;
}

function tenantStockReportFingerprint(request) {
  // Reconciliation validates every row and tenant/sede before anything is hashed.
  const report = tenantStockDiscrepancyReport(request);
  const empresaId = ownData(request, 'empresaId');
  const sedeId = ownData(request, 'sedeId');
  // Domain separator and canonical JSON tuple avoid ambiguous concatenation.
  const canonical = JSON.stringify([
    'GRUK-P0-06-stock-report-v1', empresaId, sedeId,
    report.totalSkus, report.mismatchedSkus, report.shortageUnits,
    report.surplusUnits, report.netDifferenceUnits,
    report.differences.map(row => [row.sku, row.matches, row.differenceUnits, row.absoluteDifferenceUnits])
  ]);
  return Object.freeze({
    algorithm: 'sha256',
    version: 1,
    digest: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    report
  });
}
module.exports = { tenantStockReportFingerprint };
