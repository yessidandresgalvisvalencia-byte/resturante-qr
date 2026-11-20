'use strict';

// P0-06: immutable, read-only discrepancy report for an already authorized
// single-tenant stock snapshot. No persistence, correction or audit write.
const { reconcileStockSnapshot } = require('./enterpriseStockReconciliation');

function stockDiscrepancyReport(rows) {
  const reconciled = reconcileStockSnapshot(rows);
  let shortage = 0n;
  let surplus = 0n;
  const differences = [];
  for (const row of reconciled) {
    const delta = BigInt(row.differenceUnits);
    if (delta === 0n) continue;
    if (delta < 0n) shortage -= delta;
    else surplus += delta;
    differences.push(row);
  }
  // Locale-independent order guarantees reproducible exports and signatures.
  differences.sort((a, b) => a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0);
  return Object.freeze({
    totalSkus: reconciled.length,
    mismatchedSkus: differences.length,
    shortageUnits: shortage.toString(),
    surplusUnits: surplus.toString(),
    netDifferenceUnits: (surplus - shortage).toString(),
    differences: Object.freeze(differences)
  });
}
module.exports = { stockDiscrepancyReport };
