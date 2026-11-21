"use strict";

// P0-04 bridge for legacy Number fields. Compute in integer centavos only.
// Reject values that cannot be represented as exact cents, rather than
// silently rounding historical inputs. Mongo numeric schema stays unchanged.
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function decimalParts(value, label = "monto") {
  if ((typeof value !== "number" && typeof value !== "string") ||
      (typeof value === "number" && !Number.isFinite(value))) {
    throw new Error("DINERO_INVALIDO_" + label);
  }
  const raw = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) throw new Error("DINERO_INVALIDO_" + label);
  const fraction = match[3] || "";
  // Extra zero digits are mathematically exact; nonzero 3rd decimals are not.
  if (fraction.length > 2 && /[1-9]/.test(fraction.slice(2))) {
    throw new Error("DINERO_PRECISION_" + label);
  }
  const cents = BigInt(match[2]) * 100n +
    BigInt((fraction + "00").slice(0, 2));
  return (match[1] === "-" ? -1n : 1n) * cents;
}

function safeCents(cents, label = "monto") {
  if (typeof cents !== "bigint") throw new Error("DINERO_INVALIDO_" + label);
  if (cents < -MAX || cents > MAX) throw new Error("DINERO_RANGO_" + label);
  return Number(cents) / 100;
}

function cents(value, label = "monto") {
  const result = decimalParts(value, label);
  if (result < -MAX || result > MAX) throw new Error("DINERO_RANGO_" + label);
  return result;
}

// Quantity is a signed exact decimal rational. A total must resolve to a
// whole cent (no hidden 0.005 or binary rounding). Up to six decimal places.
function quantityParts(value) {
  if ((typeof value !== "number" && typeof value !== "string") ||
      (typeof value === "number" && !Number.isFinite(value))) {
    throw new Error("DINERO_CANTIDAD_INVALIDA");
  }
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(value).trim());
  if (!match) throw new Error("DINERO_CANTIDAD_INVALIDA");
  const fractional = match[3] || "";
  if (fractional.length > 6 && /[1-9]/.test(fractional.slice(6))) {
    throw new Error("DINERO_CANTIDAD_PRECISION");
  }
  const precision = Math.min(6, fractional.length);
  const denominator = 10n ** BigInt(precision);
  const units = BigInt(match[2]) * denominator +
    BigInt((fractional.slice(0, precision) || "0"));
  const signed = match[1] === "-" ? -units : units;
  if (signed <= 0n) throw new Error("DINERO_CANTIDAD_INVALIDA");
  if (signed > MAX) throw new Error("DINERO_CANTIDAD_RANGO");
  return { units: signed, denominator };
}

function exactProduct(unitCentavos, quantity, label = "total") {
  if (typeof unitCentavos !== "bigint") throw new Error("DINERO_INVALIDO_" + label);
  const { units, denominator } = quantityParts(quantity);
  const numerator = unitCentavos * units;
  if (numerator % denominator !== 0n) {
    throw new Error("DINERO_PRODUCTO_PRECISION_" + label);
  }
  const result = numerator / denominator;
  safeCents(result, label);
  return result;
}

function saleAmounts({ precioUnitario, precio, costoUnitario, cantidad }) {
  const unitPrice = cents(precioUnitario, "precioUnitario");
  const total = cents(precio, "total");
  const unitCost = cents(costoUnitario, "costoUnitario");
  if (unitPrice < 0n || total < 0n || unitCost < 0n) {
    throw new Error("DINERO_NEGATIVO");
  }
  const cost = exactProduct(unitCost, cantidad, "costoTotal");
  // A price may legitimately include discounts, so do not force unitPrice *
  // quantity === paid total. But reject totals exceeding safe exact range.
  const profit = total - cost;
  const margin = total === 0n
    ? 0
    : Number((profit * 100000000n) / total) / 1000000;
  if (!Number.isFinite(margin)) throw new Error("DINERO_MARGEN_INVALIDO");
  return {
    precioUnitario: safeCents(unitPrice, "precioUnitario"),
    total: safeCents(total, "total"),
    costoUnitario: safeCents(unitCost, "costoUnitario"),
    costoTotal: safeCents(cost, "costoTotal"),
    utilidadBruta: safeCents(profit, "utilidadBruta"),
    margenBruto: margin
  };
}
module.exports = { cents, safeCents, exactProduct, quantityParts, saleAmounts };
