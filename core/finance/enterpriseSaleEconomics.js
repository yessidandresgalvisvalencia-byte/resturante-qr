'use strict';

// GRUK Empresarial: pure sale economics in integer minor units.
// No database schema or runtime migration; integration is a separate acceptance gate.
const { parseMoneyToCents, formatCents } = require('./enterpriseMoney');
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function saleEconomics({ quantity, total, unitCost }) {
  if (typeof quantity !== 'string' || quantity.length > 16 || !/^[1-9][0-9]*$/.test(quantity)) {
    throw new TypeError('Quantity must be a positive canonical integer string');
  }
  const qty = BigInt(quantity);
  if (qty > MAX) throw new RangeError('Quantity exceeds safe bound');
  const revenue = parseMoneyToCents(total);
  const cost = parseMoneyToCents(unitCost) * qty;
  if (cost > MAX) throw new RangeError('Cost exceeds safe cents');
  const profit = revenue - cost;
  const absoluteProfit = profit < 0n ? -profit : profit;
  // Signed basis points, rounded half-up; avoid floating point ratios.
  const marginBasisPoints = revenue === 0n ? 0n :
    (absoluteProfit * 10000n + revenue / 2n) / revenue * (profit < 0n ? -1n : 1n);
  return Object.freeze({
    costTotal: formatCents(cost),
    profit: (profit < 0n ? '-' : '') + formatCents(absoluteProfit),
    marginBasisPoints: marginBasisPoints.toString()
  });
}

module.exports = { saleEconomics };
