"use strict";
// Canonical COP money: integer minor units; never binary floats for arithmetic.
// dinero.js v1 and decimal.js are required at runtime for this isolated V1000 module.
const Dinero = require("dinero.js");
const Decimal = require("decimal.js");
const MAX = Number.MAX_SAFE_INTEGER;
function parseCop(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) throw new Error("COP_FORMATO_INVALIDO");
  const decimal = new Decimal(value);
  const cents = decimal.times(100);
  if (!cents.isInteger() || !cents.isPositive() || cents.greaterThan(MAX)) throw new Error("COP_FUERA_RANGO");
  return Dinero({amount: cents.toNumber(), currency: "COP", precision: 2});
}
function centavos(dinero) {
  if (!dinero || typeof dinero.getAmount !== "function" || dinero.getCurrency() !== "COP" ||
      dinero.getPrecision() !== 2 || !Number.isSafeInteger(dinero.getAmount())) throw new Error("COP_INVALIDO");
  return dinero.getAmount();
}
function sumarCop(a,b) {
  const resultado = BigInt(centavos(a)) + BigInt(centavos(b));
  if(resultado > BigInt(MAX) || resultado < 0n) throw new Error("COP_FUERA_RANGO");
  return Dinero({amount:Number(resultado),currency:"COP",precision:2});
}
function restarCop(a,b) {
  const resultado = BigInt(centavos(a)) - BigInt(centavos(b));
  if(resultado < 0n) throw new Error("COP_SALDO_NEGATIVO");
  return Dinero({amount:Number(resultado),currency:"COP",precision:2});
}
module.exports={parseCop,centavos,sumarCop,restarCop};
