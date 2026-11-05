"use strict";

// Amounts are represented as integer minor units. Never use JS Number for money.
const MAX_DIGITS = 38;
function parseMinorUnits(value, scale = 2) {
  if (typeof value !== "string" || !Number.isInteger(scale) || scale < 0 || scale > 9) {
    throw new TypeError("Amount must be a decimal string and scale an integer from 0 to 9");
  }
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new RangeError("Invalid decimal amount");
  }
  // Reject oversized untrusted inputs before allocating large BigInts.\n  if (value.length > MAX_DIGITS + 11) throw new RangeError("Amount exceeds supported precision");\n  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  if (fraction.length > scale) throw new RangeError("Excess fractional precision");
  if (whole.length > MAX_DIGITS) throw new RangeError("Amount exceeds supported precision");
  const digits = whole + fraction.padEnd(scale, "0");
  const amount = BigInt(digits);
  return negative ? -amount : amount;
}
function formatMinorUnits(minor, scale = 2) {
  if (typeof minor !== "bigint" || !Number.isInteger(scale) || scale < 0 || scale > 9) {
    throw new TypeError("Minor units must be bigint and scale an integer from 0 to 9");
  }
  const sign = minor < 0n ? "-" : "";
  const digits = (minor < 0n ? -minor : minor).toString().padStart(scale + 1, "0");
  if (minor === 0n) return scale ? "0." + "0".repeat(scale) : "0";
  return sign + (scale ? digits.slice(0, -scale) + "." + digits.slice(-scale) : digits);
}
module.exports = { parseMinorUnits, formatMinorUnits };
