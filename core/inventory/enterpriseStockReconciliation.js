'use strict';

// GRUK Empresarial only. Read-only stock reconciliation; no writes or side effects.
// Quantities are canonical integer strings to prevent floating-point loss.
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
function quantity(value) {
  if (typeof value !== 'string' || value.length > 16 || !/^(?:0|[1-9]\d*)$/.test(value)) {
    throw new TypeError('Stock quantity must be a canonical nonnegative integer string');
  }
  const parsed = BigInt(value);
  if (parsed > MAX) throw new RangeError('Stock quantity exceeds safe integer bound');
  return parsed;
}
function reconcileStock(recorded, counted) {
  const expected = quantity(recorded);
  const actual = quantity(counted);
  const delta = actual - expected;
  return Object.freeze({
    matches: delta === 0n,
    differenceUnits: delta.toString(),
    absoluteDifferenceUnits: (delta < 0n ? -delta : delta).toString()
  });
}
// Atomic, read-only reconciliation of a single tenant's stock-count snapshot.
// Callers must authorize empresaId and load the tenant-scoped snapshot beforehand.
function reconcileStockSnapshot(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Stock snapshot must be an array');
  // Bound work before iterating untrusted snapshots; no partial result escapes.
  if (rows.length > 10000) throw new RangeError('Stock snapshot exceeds 10000 rows');
  const seen = new Set();
  const output = [];
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row) ||
        !Object.hasOwn(row, 'sku') || !Object.hasOwn(row, 'recorded') ||
        !Object.hasOwn(row, 'counted')) {
      throw new TypeError('Stock row requires own sku, recorded and counted fields');
    }
    // Reject accessors before reading untrusted rows: getters can execute arbitrary
    // side effects even in a nominally read-only reconciliation.
    const skuField = Object.getOwnPropertyDescriptor(row, 'sku');
    const recordedField = Object.getOwnPropertyDescriptor(row, 'recorded');
    const countedField = Object.getOwnPropertyDescriptor(row, 'counted');
    if (!skuField || !recordedField || !countedField ||
        !Object.hasOwn(skuField, 'value') || !Object.hasOwn(recordedField, 'value') ||
        !Object.hasOwn(countedField, 'value')) {
      throw new TypeError('Stock row fields must be own data properties');
    }
    const sku = skuField.value;
    if (typeof sku !== 'string' || sku.length === 0 || sku.length > 128 ||
        sku.trim() !== sku || /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/.test(sku)) {
      throw new TypeError('Stock SKU must be a bounded canonical identifier');
    }
    if (seen.has(sku)) throw new TypeError('Duplicate SKU in stock snapshot');
    seen.add(sku);
    const result = reconcileStock(recordedField.value, countedField.value);
    output.push(Object.freeze({ sku, ...result }));
  }
  return Object.freeze(output);
}
module.exports = { reconcileStock, reconcileStockSnapshot };
