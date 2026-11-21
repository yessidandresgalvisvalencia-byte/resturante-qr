"use strict";

// P0-07: lossless monetary serialization for future ledger/persistence boundaries.
// Does not change legacy Mongo Number fields or existing saleAmounts consumers.
const { cents } = require("./dineroExacto");
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function centavosToDecimal(value, label = "monto") {
  if (typeof value !== "bigint") throw new Error("DINERO_INVALIDO_" + label);
  if (value > MAX || value < -MAX) throw new Error("DINERO_RANGO_" + label);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 100n;
  const fractional = (absolute % 100n).toString().padStart(2, "0");
  return (negative ? "-" : "") + whole.toString() + "." + fractional;
}

function decimalToCentavos(value, label = "monto") {
  // Refuse numeric inputs: JSON numbers can already have lost decimal precision.
  if (typeof value !== "string") throw new Error("DINERO_INVALIDO_" + label);
  return cents(value, label);
}

module.exports = { centavosToDecimal, decimalToCentavos };
