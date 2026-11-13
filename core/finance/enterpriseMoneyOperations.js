'use strict';

// GRUK Empresarial only. Pure, deterministic primitives; no I/O or personal-finance imports.
const { parseMoneyToCents, formatCents } = require('./enterpriseMoney');
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);
// Bound untrusted invoice batch size before iterating or allocating totals.
const MAX_INVOICE_LINES = 10000;

function assertQuantity(quantity) {
  // Reject oversized untrusted input before the regular expression scans it.
  if (typeof quantity === 'string' && quantity.length > 16) {
    throw new RangeError('Quantity exceeds safe integer bound');
  }
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
  if (lines.length > MAX_INVOICE_LINES) throw new RangeError('Invoice exceeds maximum line count');
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

// Tax calculation is opt-in: callers must provide the legally applicable rate.
// Basis points represent hundredths of a percent (1900 = 19%). This function
// does not infer taxability, jurisdiction, exemptions, or invoice-level policy.
// Round HALF UP on positive minor units, exactly once at the caller's chosen base.
function taxAmount(base, rateBasisPoints) {
  const baseCents = parseMoneyToCents(base);
  if (typeof rateBasisPoints !== 'string' || rateBasisPoints.length > 5 ||
      !/^(?:0|[1-9]\d*)$/.test(rateBasisPoints)) {
    throw new TypeError('Tax rate must be a canonical integer basis-point string');
  }
  const rate = BigInt(rateBasisPoints);
  if (rate > 10000n) throw new RangeError('Tax rate exceeds 100 percent');
  const taxCents = (baseCents * rate + 5000n) / 10000n;
  return formatCents(assertSafeCents(taxCents));
}

module.exports = { lineTotal, invoiceTotal, reconcile, taxAmount };
