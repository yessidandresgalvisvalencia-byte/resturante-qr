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
function addMinorUnits(a, b) {
  return (parseMinorUnits(a) + parseMinorUnits(b)).toString();
}
function subtractMinorUnits(a, b) {
  return (parseMinorUnits(a) - parseMinorUnits(b)).toString();
}
function sumMinorUnits(values) {
  if (!Array.isArray(values)) throw new TypeError("Expected array of minor-unit strings");
  return values.reduce((total, value) => total + parseMinorUnits(value), 0n).toString();
}
module.exports = { parseMinorUnits, addMinorUnits, subtractMinorUnits, sumMinorUnits };
