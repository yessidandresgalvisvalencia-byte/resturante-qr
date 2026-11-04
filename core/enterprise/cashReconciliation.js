"use strict";
// Enterprise-only cash reconciliation. Inputs are independently confirmed totals
// in canonical minor-unit strings; this does not fetch or modify ledger records.
const { subtractMinorUnits, parseMinorUnits } = require("./moneyMinorUnits");
function reconcileCash({ expected, counted, tolerance = "0" }) {
  const expectedMinor = parseMinorUnits(expected);
  const countedMinor = parseMinorUnits(counted);
  const toleranceMinor = parseMinorUnits(tolerance);
  if (toleranceMinor < 0n) throw new RangeError("Tolerance must be nonnegative");
  const difference = subtractMinorUnits(counted, expected);
  const absoluteDifference = difference[0] === "-" ? difference.slice(1) : difference;
  return Object.freeze({
    expected: expectedMinor.toString(),
    counted: countedMinor.toString(),
    difference,
    withinTolerance: BigInt(absoluteDifference) <= toleranceMinor
  });
}
module.exports = { reconcileCash };
