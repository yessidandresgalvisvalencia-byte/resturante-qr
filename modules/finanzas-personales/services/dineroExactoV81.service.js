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
// GMF 4x1000: estimación conservadora, redondeada hacia arriba al centavo.
// Se aplica únicamente al valor que el llamador identifica como retiro gravado;
// una cuenta o transferencia exenta debe suministrar 0n.
function reservarGmfCentavos(retiroGravadoCentavos) {
  if (typeof retiroGravadoCentavos !== "bigint" || retiroGravadoCentavos < 0n) {
    throw new TypeError("Retiro gravado debe ser BigInt no negativo");
  }
  return (retiroGravadoCentavos * 4n + 999n) / 1000n;
}
// El llamador debe determinar antes si el retiro está gravado.
// Omitir ese dato no equivale a una exención.
function disponibleHoyConGmf({ saldoCentavos, porVencer7dCentavos, retiroGravadoCentavos }) {
  const base = disponibleHoy({ saldoCentavos, porVencer7dCentavos });
  const reserva4x1000Centavos = reservarGmfCentavos(retiroGravadoCentavos);
  return Object.freeze({
    disponibleCentavos: base.disponibleCentavos - reserva4x1000Centavos,
    colchonCentavos: base.colchonCentavos,
    reserva4x1000Centavos
  });
}
module.exports = { parsearCopACentavos, sumarCentavos, disponibleHoy, reservarGmfCentavos, disponibleHoyConGmf };
