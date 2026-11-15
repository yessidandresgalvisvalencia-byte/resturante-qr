'use strict';

// Plan Maestro 06 [P0]: deterministic discrepancy report for an already
// authorized, tenant-scoped snapshot. No persistence, correction, or audit write.
const { reconcileTenantStockSnapshot } = require('./enterpriseStockTenantScope');

function tenantStockDiscrepancyReport(request) {
  const reconciled = reconcileTenantStockSnapshot(request);
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
module.exports = { tenantStockDiscrepancyReport };
