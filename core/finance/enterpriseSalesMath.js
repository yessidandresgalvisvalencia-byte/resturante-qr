'use strict';

// P0-07: pure financial calculation. Inputs are canonical COP decimal strings.
// Never accept JS Numbers, and never round silently.
const { parseMoneyToCents } = require('./enterpriseMoney');
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function calculateSale({ quantity, unitPrice, unitCost, total }) {
  if (typeof quantity !== 'string' || !/^[1-9]\d{0,8}$/.test(quantity)) {
    throw new TypeError('quantity must be a canonical positive integer string');
  }
  const qty = BigInt(quantity);
  const price = parseMoneyToCents(unitPrice);
  const cost = parseMoneyToCents(unitCost);
  const charged = parseMoneyToCents(total);
  const linePrice = qty * price;
  const lineCost = qty * cost;
  if (linePrice > MAX || lineCost > MAX) throw new RangeError('line amount exceeds safe cents');
  if (charged > linePrice) throw new RangeError('charged total exceeds undiscounted line amount');
  const profit = charged - lineCost;
  // Signed margin in basis points, truncation toward zero is explicit.
  const marginBasisPoints = charged === 0n ? null : (profit * 10000n / charged);
  return Object.freeze({
    grossCents: linePrice.toString(),
    discountCents: (linePrice - charged).toString(),
    revenueCents: charged.toString(),
    costCents: lineCost.toString(),
    profitCents: profit.toString(),
    marginBasisPoints: marginBasisPoints === null ? null : marginBasisPoints.toString()
  });
}

// Transitional read-only bridge for legacy Mongo Number fields. This does not
// certify the original binary float or rewrite historical financial records.
// Reject exponential notation, negative zero and subcent precision rather than
// rounding or coercing unsafe historical values.
function canonicalLegacyMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0)) {
    throw new TypeError('legacy money must be a finite non-negative Number');
  }
  const decimal = value.toString();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(decimal)) {
    throw new RangeError('legacy money is not a plain cent-exact decimal');
  }
  const cents = parseMoneyToCents(decimal);
  if (cents > MAX) throw new RangeError('legacy money exceeds safe cents');
  return decimal;
}

function calculateLegacySale({ quantity, unitPrice, unitCost, total }) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new TypeError('legacy quantity must be a positive safe integer');
  }
  return calculateSale({
    quantity: String(quantity),
    unitPrice: canonicalLegacyMoney(unitPrice),
    unitCost: canonicalLegacyMoney(unitCost),
    total: canonicalLegacyMoney(total)
  });
}

module.exports = { calculateSale, canonicalLegacyMoney, calculateLegacySale };
