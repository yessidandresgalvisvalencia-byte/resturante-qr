'use strict';

// GRUK Empresarial only. Pure, deterministic primitives; no I/O or personal-finance imports.
const { parseMoneyToCents, formatCents } = require('./enterpriseMoney');
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

function assertQuantity(quantity) {
  if (typeof quantity !== 'string' || !/^(?:0|[1-9]\d*)$/.test(quantity)) {
    throw new TypeError('Quantity must be a canonical nonnegative integer string');
  }
  // Bound parsing cost and reject implausibly large quantities even for zero-price lines.
  // Never convert quantities to Number or accept exponent notation.
  if (quantity.length > 16 || BigInt(quantity) > MAX_CENTS) {
    throw new RangeError('Quantity exceeds safe integer bound');
  }
  return BigInt(quantity);
}

function assertSafeCents(value) {
  if (value < 0n || value > MAX_CENTS) throw new RangeError('Amount exceeds safe integer cents');
  return value;
}

// Never convert amounts or quantities through Number.
function lineTotal(unitPrice, quantity) {
  return formatCents(assertSafeCents(parseMoneyToCents(unitPrice) * assertQuantity(quantity)));
}

function invoiceTotal(lines) {
  if (!Array.isArray(lines)) throw new TypeError('Lines must be an array');
  let total = 0n;
  for (const line of lines) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) throw new TypeError('Invalid invoice line');
    total = assertSafeCents(total + parseMoneyToCents(line.unitPrice) * assertQuantity(line.quantity));
  }
  return formatCents(total);
}

// Reconciliation compares independently computed canonical amounts, preserving the sign.
function reconcile(expected, observed) {
  const difference = parseMoneyToCents(observed) - parseMoneyToCents(expected);
  return Object.freeze({
    matches: difference === 0n,
    differenceCents: difference.toString(),
    absoluteDifference: formatCents(difference < 0n ? -difference : difference)
  });
}

module.exports = { lineTotal, invoiceTotal, reconcile };
