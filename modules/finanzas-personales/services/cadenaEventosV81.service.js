"use strict";
const { createHash } = require("node:crypto");
const GENESIS = "0".repeat(64);
function textoEvento({ id, userId, tipo, montoCentavos, fechaContable, timestamp, corrigeId = null, motivo = null, tipoCorregido = null, version }) {
  if (typeof id !== "string" || !id || typeof userId !== "string" || !userId) throw new TypeError("Identidad del evento inválida");
  if (!["INGRESO", "GASTO", "CORRECCION", "ANULACION"].includes(tipo)) throw new TypeError("Tipo inválido");
  if (typeof montoCentavos !== "bigint" || montoCentavos < 0n || (montoCentavos === 0n && !["CORRECCION", "ANULACION"].includes(tipo))) throw new TypeError("Monto inválido");
  if (typeof fechaContable !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fechaContable) || new Date(fechaContable + "T00:00:00Z").toISOString().slice(0, 10) !== fechaContable) throw new TypeError("Fecha contable inválida");
  if (typeof timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw new TypeError("Timestamp inválido");
  if (tipo === "CORRECCION" && !["INGRESO", "GASTO"].includes(tipoCorregido)) throw new TypeError("Tipo corregido inválido");
  if (!Number.isSafeInteger(version) || version < 1) throw new TypeError("Versión inválida");
  if (["CORRECCION", "ANULACION"].includes(tipo) && (typeof corrigeId !== "string" || !corrigeId || typeof motivo !== "string" || !motivo.trim())) throw new TypeError("Corrección sin referencia o motivo");
  return JSON.stringify([id, userId, tipo, montoCentavos.toString(), fechaContable, timestamp, corrigeId, motivo, tipoCorregido, version]);
}
function calcularHash(hashAnterior, contenido) {
  if (typeof hashAnterior !== "string" || !/^[a-f0-9]{64}$/.test(hashAnterior)) throw new TypeError("Hash anterior inválido");
  return createHash("sha256").update(hashAnterior + ":" + contenido, "utf8").digest("hex");
}
function crearEvento(datos, hashAnterior = GENESIS) {
  const contenido = textoEvento(datos);
  return Object.freeze({ ...datos, hashAnterior, hashActual: calcularHash(hashAnterior, contenido) });
}
function verificarCadena(eventos, hashCabezaEsperado) {
  if (hashCabezaEsperado !== undefined && (typeof hashCabezaEsperado !== "string" || !/^[a-f0-9]{64}$/.test(hashCabezaEsperado))) throw new TypeError("Hash de referencia inválido");
  if (!Array.isArray(eventos)) throw new TypeError("La cadena debe ser una lista");
  // Sin eventos no hay evidencia de integridad: no dar un falso positivo.
  if (eventos.length === 0) return false;
  let anterior = GENESIS, version = 0, usuario = null;
  try {
    for (const e of eventos) {
      if (!e || (usuario !== null && e.userId !== usuario)) return false;
      usuario = e.userId;
      if (e.version !== ++version || e.hashAnterior !== anterior || e.hashActual !== calcularHash(anterior, textoEvento(e))) return false;
      anterior = e.hashActual;
    }
    return hashCabezaEsperado === undefined || anterior === hashCabezaEsperado;
  } catch (_) {
    return false;
  }
}
module.exports = { GENESIS, crearEvento, verificarCadena };
