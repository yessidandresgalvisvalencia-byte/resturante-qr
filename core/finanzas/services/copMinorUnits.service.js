"use strict";

const MAX = 999999999999999999999999n;
const MINOR = /^(0|[1-9][0-9]*)$/;
const DECIMAL = new RegExp('^(0|[1-9][0-9]*)([.][0-9]{1,2})?$');

function copToMinor(value) {
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    throw new TypeError("COP_DECIMAL_INVALIDO");
  }
  const [units, cents = ""] = value.split(".");
  const amount = BigInt(units) * 100n + BigInt(cents.padEnd(2, "0") || "0");
  if (amount > MAX) throw new RangeError("COP_FUERA_DE_RANGO");
  return amount.toString();
}

function minorToCop(value) {
  if (typeof value !== "string" || !MINOR.test(value)) {
    throw new TypeError("COP_MENORES_INVALIDOS");
  }
  const amount = BigInt(value);
  if (amount > MAX) throw new RangeError("COP_FUERA_DE_RANGO");
  return (amount / 100n).toString() + "." +
    (amount % 100n).toString().padStart(2, "0");
}

module.exports = { copToMinor, minorToCop };
