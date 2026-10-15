"use strict";

const { listarEntregasRecuperables } = require("./listarEntregasRecuperables.service");
const { procesarEntregaCaja } = require("./procesarEntregaCaja.service");
const { procesarEntregaFacturacion } = require("../../core/facturacion/procesarEntregaFacturacion.service");
const { cerrarVentaEntregada } = require("./cerrarVentaEntregada.service");

const HANDLERS = Object.freeze({
  CAJA_VENTA_V1: procesarEntregaCaja,
  FACTURACION_VENTA_V1: procesarEntregaFacturacion
});

/**
 * Explicit, tenant-scoped invocation only. No timer, background worker or
 * automatic startup wiring. Each consumer keeps its own lease and ACID receipt.
 */
async function procesarLoteRecuperacion({ empresaId, consumidor, limit = 25, now = new Date() }) {
  const candidates = await listarEntregasRecuperables({ empresaId, consumidor, limit, now });
  const handler = HANDLERS[consumidor];
  const resultados = [];
  for (const candidate of candidates) {
    try {
      const result = await handler({ empresaId, eventId: candidate.eventId });
      resultados.push({ eventId: candidate.eventId, ok: true, ...result });
    } catch (error) {
      resultados.push({
        eventId: candidate.eventId, ok: false,
        codigo: String(error?.code || error?.message || "ENTREGA_RECUPERACION_FALLO").slice(0, 160)
      });
    }
  }
  // Close only after the two required and any additional consumer ACKs.
  // A failed close must not erase successful per-consumer delivery receipts.
  const seen = new Set();
  const cierres = [];
  for (const candidate of candidates) {
    const key = String(candidate.eventId);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const cierre = await cerrarVentaEntregada({ empresaId, eventId: candidate.eventId });
      cierres.push({ eventId: candidate.eventId, ok: true, ...cierre });
    } catch (error) {
      cierres.push({
        eventId: candidate.eventId, ok: false,
        codigo: String(error?.code || error?.message || "OUTBOX_CIERRE_FALLO").slice(0, 160)
      });
    }
  }
  return { consumidor, encontrados: candidates.length, resultados, cierres };
}

module.exports = { procesarLoteRecuperacion };
