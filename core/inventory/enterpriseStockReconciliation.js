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
module.exports = { reconcileStock };
