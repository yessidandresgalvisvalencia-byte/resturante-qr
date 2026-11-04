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
module.exports = { parseMinorUnits, addMinorUnits, subtractMinorUnits, sumMinorUnits };
