"use strict";
// Pure enterprise reporting calculation. All amounts are canonical minor-unit strings.
// Inputs are already classified by the caller; this module never infers accounting meaning.
const { addMinorUnits, subtractMinorUnits, sumMinorUnits, applyBasisPoints } = require("./moneyMinorUnits");
function calculateFinancialSnapshot({ sales, costs, cashIn, cashOut, receivables, payables, taxBasisPoints }) {
  for (const [name, value] of Object.entries({ sales, costs, cashIn, cashOut, receivables, payables })) {
    if (!Array.isArray(value)) throw new TypeError(name + " must be an array");
  }
  const revenue = sumMinorUnits(sales);
  const totalCosts = sumMinorUnits(costs);
  const margin = subtractMinorUnits(revenue, totalCosts);
  const netCashFlow = subtractMinorUnits(sumMinorUnits(cashIn), sumMinorUnits(cashOut));
  const netReceivables = subtractMinorUnits(sumMinorUnits(receivables), sumMinorUnits(payables));
  // Tax is a scenario estimate, not a booked tax liability; never double-count as cash.
  const estimatedTax = applyBasisPoints(revenue, taxBasisPoints);
  return Object.freeze({ revenue, totalCosts, margin, netCashFlow, netReceivables, estimatedTax });
}
module.exports = { calculateFinancialSnapshot };
