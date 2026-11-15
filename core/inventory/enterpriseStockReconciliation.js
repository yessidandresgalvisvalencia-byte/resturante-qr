'use strict';

// GRUK Empresarial only. Read-only stock reconciliation; no writes or side effects.
// Quantities are canonical integer strings to prevent floating-point loss.
const { types: { isProxy } } = require('node:util');
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
  // Proxy traps can execute code even during descriptor inspection or Array.isArray.
  if (isProxy(rows)) throw new TypeError('Stock snapshot proxies are not allowed');
  if (!Array.isArray(rows)) throw new TypeError('Stock snapshot must be an array');
  // Bound work before iterating untrusted snapshots; no partial result escapes.
  if (rows.length > 10000) throw new RangeError('Stock snapshot exceeds 10000 rows');
  // Read only own data slots: array index getters and inherited slots must never
  // execute while processing an untrusted stock-count snapshot.
  const seen = new Set();
  const output = [];
  for (let index = 0; index < rows.length; index += 1) {
    const slot = Object.getOwnPropertyDescriptor(rows, String(index));
    if (!slot || !Object.hasOwn(slot, 'value')) {
      throw new TypeError('Stock snapshot requires own data elements');
    }
    const row = slot.value;
    if (isProxy(row)) throw new TypeError('Stock row proxies are not allowed');
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
        sku.trim() !== sku || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(sku)) {
      throw new TypeError('Stock SKU must be a bounded canonical identifier');
    }
    if (seen.has(sku)) throw new TypeError('Duplicate SKU in stock snapshot');
    seen.add(sku);
    const result = reconcileStock(recordedField.value, countedField.value);
    output.push(Object.freeze({ sku, ...result }));
  }
  return Object.freeze(output);
}
// Deterministic read-only aggregate for an already validated single-tenant snapshot.
// Counts rows, shortages and surpluses without lossy Number arithmetic. This helper
// never queries or writes stock; tenant authorization remains the caller's duty.
function summarizeStockSnapshot(rows) {
  const reconciled = reconcileStockSnapshot(rows);
  let shortageUnits = 0n;
  let surplusUnits = 0n;
  let mismatchedSkus = 0;
  for (const row of reconciled) {
    const difference = BigInt(row.differenceUnits);
    if (difference < 0n) {
      shortageUnits -= difference;
      mismatchedSkus += 1;
    } else if (difference > 0n) {
      surplusUnits += difference;
      mismatchedSkus += 1;
    }
  }
  return Object.freeze({
    totalSkus: reconciled.length,
    matchedSkus: reconciled.length - mismatchedSkus,
    mismatchedSkus,
    shortageUnits: shortageUnits.toString(),
    surplusUnits: surplusUnits.toString(),
    netDifferenceUnits: (surplusUnits - shortageUnits).toString()
  });
}
module.exports = { reconcileStock, reconcileStockSnapshot, summarizeStockSnapshot };
