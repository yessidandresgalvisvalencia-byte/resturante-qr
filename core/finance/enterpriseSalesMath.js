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

module.exports = { calculateSale };
