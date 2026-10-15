"use strict";

const { despacharSiguienteVenta } = require("./ventaOutbox.dispatcher");
const { consumirVentaEnCaja } = require("./cajaVenta.consumer");

/**
 * Explicit opt-in Caja delivery. This does not register a legacy EventBus
 * listener or schedule a worker; callers must control invocation.
 */
async function despacharSiguienteVentaACaja({ now } = {}) {
  return despacharSiguienteVenta({
    ...(now === undefined ? {} : { now }),
    emitir: async (eventName, payload, metadata) => {
      if (eventName !== "VENTA_COMPLETADA" ||
          String(payload?.empresaId) !== String(metadata?.empresaId) ||
          String(payload?.ventaId) !== String(metadata?.aggregateId)) {
        throw new Error("CAJA_OUTBOX_IDENTIDAD_INCONSISTENTE");
      }
      const resultado = await consumirVentaEnCaja({
        eventId: metadata.eventId,
        empresaId: metadata.empresaId
      });
      return resultado.aplicado === true || resultado.duplicado === true;
    }
  });
}

module.exports = { despacharSiguienteVentaACaja };
