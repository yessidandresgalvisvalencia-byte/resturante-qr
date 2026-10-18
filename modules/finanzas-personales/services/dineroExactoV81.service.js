"use strict";
// Aritmética monetaria COP exacta. Entrada en texto; jamás Number ni float.
function parsearCopACentavos(valor) {
  if (typeof valor !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(valor)) {
    throw new TypeError("Monto COP inválido: usa texto decimal no negativo, sin separadores de miles");
  }
  const [entero, decimales = ""] = valor.split(".");
  return BigInt(entero) * 100n + BigInt(decimales.padEnd(2, "0"));
}
function sumarCentavos(valores) {
  if (!Array.isArray(valores) || !valores.every(x => typeof x === "bigint")) {
    throw new TypeError("Se requieren montos BigInt en centavos");
  }
  return valores.reduce((a, b) => a + b, 0n);
}
function disponibleHoy({ saldoCentavos, porVencer7dCentavos }) {
  if (typeof saldoCentavos !== "bigint" || typeof porVencer7dCentavos !== "bigint" ||
      porVencer7dCentavos < 0n) throw new TypeError("Importes inválidos");
  const colchonCentavos = saldoCentavos > 0n ? saldoCentavos / 10n : 0n;
  const disponibleCentavos = saldoCentavos - porVencer7dCentavos - colchonCentavos;
  return Object.freeze({ disponibleCentavos, colchonCentavos });
}
module.exports = { parsearCopACentavos, sumarCentavos, disponibleHoy };
