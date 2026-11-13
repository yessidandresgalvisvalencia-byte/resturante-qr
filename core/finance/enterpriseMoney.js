'use strict';

// GRUK Empresarial: deterministic COP amount parsing, without binary floating-point arithmetic.
// Accepts canonical decimal strings (dot as decimal separator); rejects localized/ambiguous input.
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);
function parseMoneyToCents(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Money must be a nonnegative canonical decimal string with at most two decimals');
  }
  // Reject oversized untrusted values before regular-expression scanning or BigInt conversion.
  // MAX_SAFE_INTEGER cents permits up to 14 whole digits, a dot and 2 decimals.
  if (value.length > 17) throw new RangeError('Money amount exceeds safe integer cents');
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new TypeError('Money must be a nonnegative canonical decimal string with at most two decimals');
  }
  const wholePart = value.split('.', 1)[0];
  if (wholePart.length > 14) throw new RangeError('Money amount exceeds safe integer cents');
  const [whole, fraction = ''] = value.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  if (cents > MAX_CENTS) throw new RangeError('Money amount exceeds safe integer cents');
  return cents;
}
function formatCents(cents) {
  if (typeof cents !== 'bigint' || cents < 0n || cents > MAX_CENTS) throw new RangeError('Invalid cents');
  return (cents / 100n).toString() + '.' + (cents % 100n).toString().padStart(2, '0');
}
module.exports = { parseMoneyToCents, formatCents };
