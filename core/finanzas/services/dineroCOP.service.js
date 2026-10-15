"use strict";
const Dinero = require("dinero.js");
const Decimal = require("decimal.js");
const COP = "COP";
function enteroSeguro(value) {
  if (!Number.isSafeInteger(value)) throw new TypeError("MONTO_CENTAVOS_INVALIDO");
  return value;
}
function crearCOP(centavos) {
  return Dinero({ amount: enteroSeguro(centavos), currency: COP, precision: 2 });
}
function decimalACentavos(value) {
  const d = new Decimal(value);
  if (!d.isFinite()) throw new TypeError("MONTO_INVALIDO");
  const centavos = d.mul(100);
  if (!centavos.isInteger()) throw new TypeError("MONTO_CON_FRACCION_DE_CENTAVO");
  return enteroSeguro(centavos.toNumber());
}
function sumarCOP(a, b) {
  return crearCOP(a).add(crearCOP(b)).getAmount();
}
function restarCOP(a, b) {
  return crearCOP(a).subtract(crearCOP(b)).getAmount();
}
function multiplicarCOP(centavos, factor) {
  const resultado = new Decimal(enteroSeguro(centavos)).mul(new Decimal(factor));
  if (!resultado.isFinite()) throw new TypeError("FACTOR_INVALIDO");
  const redondeado = resultado.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
  return enteroSeguro(redondeado.toNumber());
}
module.exports = { crearCOP, decimalACentavos, sumarCOP, restarCOP, multiplicarCOP };
