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
  const seen = new Set();
  const output = [];
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row) ||
        !Object.hasOwn(row, 'sku') || !Object.hasOwn(row, 'recorded') ||
        !Object.hasOwn(row, 'counted')) {
      throw new TypeError('Stock row requires own sku, recorded and counted fields');
    }
    const sku = row.sku;
    if (typeof sku !== 'string' || sku.length === 0 || sku.length > 128 ||
        sku.trim() !== sku || /[\\u0000-\\u001f\\u007f]/.test(sku)) {
      throw new TypeError('Stock SKU must be a bounded canonical identifier');
    }
    if (seen.has(sku)) throw new TypeError('Duplicate SKU in stock snapshot');
    seen.add(sku);
    const result = reconcileStock(row.recorded, row.counted);
    output.push(Object.freeze({ sku, ...result }));
  }
  return Object.freeze(output);
}
module.exports = { reconcileStock, reconcileStockSnapshot };
