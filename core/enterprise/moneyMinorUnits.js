"use strict";

// Enterprise-only deterministic monetary primitive. Values are integer minor units.
// Do not convert these amounts to Number for persistence or arithmetic.
const MAX_DIGITS = 30;
function parseMinorUnits(value) {
  if (typeof value !== "string" || !/^-?(0|[1-9][0-9]*)$/.test(value)) {
    throw new TypeError("Minor units must be a canonical integer string");
  }
  const digits = value[0] === "-" ? value.slice(1) : value;
  if (digits.length > MAX_DIGITS || value === "-0") throw new RangeError("Invalid minor-unit magnitude");
  return BigInt(value);
}
function formatMinorUnits(result) {
  const canonical = result.toString();
  // Bound outputs too: valid inputs can overflow the persistence contract when combined.
  if (canonical.replace(/^-/, "").length > MAX_DIGITS) {
    throw new RangeError("Minor-unit result exceeds supported magnitude");
  }
  return canonical;
}
function addMinorUnits(a, b) {
  return formatMinorUnits(parseMinorUnits(a) + parseMinorUnits(b));
}
function subtractMinorUnits(a, b) {
  return formatMinorUnits(parseMinorUnits(a) - parseMinorUnits(b));
}
function sumMinorUnits(values) {
  if (!Array.isArray(values)) throw new TypeError("Expected array of minor-unit strings");
  return formatMinorUnits(values.reduce((total, value) => total + parseMinorUnits(value), 0n));
}

// Deterministic ratio calculation for explicit rates (10000 bps = 100%).
// Round half away from zero, including negative refunds; no floating point.
function applyBasisPoints(amount, basisPoints) {
  const minor = parseMinorUnits(amount);
  if (typeof basisPoints !== "string" || !/^(0|[1-9][0-9]*)$/.test(basisPoints)) {
    throw new TypeError("Basis points must be a canonical nonnegative integer string");
  }
  if (basisPoints.length > 6) throw new RangeError("Basis-point rate exceeds supported range");
  const rate = BigInt(basisPoints);
  const product = minor * rate;
  const abs = product < 0n ? -product : product;
  const rounded = (abs + 5000n) / 10000n;
  return formatMinorUnits(product < 0n ? -rounded : rounded);
}

module.exports = { parseMinorUnits, addMinorUnits, subtractMinorUnits, sumMinorUnits, applyBasisPoints };
