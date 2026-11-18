'use strict';

// GRUK Empresarial P0-07: deterministic inventory valuation. Pure; no DB or LLM.
const { parseMoneyToCents, formatCents } = require('./enterpriseMoney');
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_ITEMS = 10000;

function canonicalStockQuantity(value) {
  if (typeof value !== 'string' || value.length > 16 ||
      !/^(?:0|[1-9]\d*)$/.test(value)) {
    throw new TypeError('Stock quantity must be a canonical nonnegative integer string');
  }
  const quantity = BigInt(value);
  if (quantity > MAX_CENTS) throw new RangeError('Stock quantity exceeds safe integer bound');
  return quantity;
}

// Values stock at explicitly supplied unit cost. No implied costing policy,
// tax, currency conversion, rounding, or mutation of source records.
function valueStock(items) {
  if (!Array.isArray(items)) throw new TypeError('Stock items must be an array');
  if (items.length > MAX_ITEMS) throw new RangeError('Stock item count exceeds limit');
  let cents = 0n;
  for (let i = 0; i < items.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(items, i)) {
      throw new TypeError('Sparse stock arrays are not allowed');
    }
    const item = items[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError('Invalid stock item');
    }
    if (!Object.prototype.hasOwnProperty.call(item, 'unitCost') ||
        !Object.prototype.hasOwnProperty.call(item, 'quantity')) {
      throw new TypeError('Stock item requires explicit own unitCost and quantity');
    }
    const cost = parseMoneyToCents(item.unitCost);
    const quantity = canonicalStockQuantity(item.quantity);
    cents += cost * quantity;
    if (cents > MAX_CENTS) throw new RangeError('Stock value exceeds safe integer cents');
  }
  return Object.freeze({ totalCost: formatCents(cents), totalCents: cents.toString() });
}

module.exports = { valueStock };
