"use strict";

const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 3_600_000;

/**
 * Deterministic, pure retry classification. It does not modify a delivery,
 * schedule a job, or acknowledge any side effect.
 * Quarantine is advisory until an atomic state transition is implemented.
 */
function evaluarReintentoEntrega({ intentos, estado, leaseHasta = null, now = new Date() }) {
  if (!Number.isSafeInteger(intentos) || intentos < 0 ||
      !["PENDIENTE", "PROCESANDO", "ENTREGADO"].includes(estado) ||
      !(now instanceof Date) || !Number.isFinite(now.getTime()) ||
      (leaseHasta !== null && (!(leaseHasta instanceof Date) ||
        !Number.isFinite(leaseHasta.getTime())))) {
    throw new Error("ENTREGA_REINTENTO_PARAMETROS_INVALIDOS");
  }
  if (estado === "ENTREGADO") return { accion: "NINGUNA", motivo: "ENTREGADA" };
  if (estado === "PROCESANDO" && (!leaseHasta || leaseHasta.getTime() > now.getTime())) {
    return { accion: "ESPERAR", motivo: "LEASE_ACTIVO_O_INDETERMINADO" };
  }
  if (intentos >= MAX_ATTEMPTS) {
    return { accion: "CUARENTENA_RECOMENDADA", motivo: "MAX_INTENTOS", intentos };
  }
  const delayMs = intentos === 0 ? 0 :
    Math.min(MAX_DELAY_MS, BASE_DELAY_MS * (2 ** Math.min(intentos - 1, 20)));
  return { accion: "REINTENTAR", delayMs, intentos };
}

module.exports = { evaluarReintentoEntrega, MAX_ATTEMPTS };
