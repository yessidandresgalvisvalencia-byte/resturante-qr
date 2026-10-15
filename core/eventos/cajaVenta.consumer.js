"use strict";

const { consumirEventoUnaVez } = require("./consumidorIdempotente.service");
const { registrarMovimientoDesdeEvento } = require("../finanzas/caja.service");

async function consumirVentaEnCaja({ eventId, empresaId }) {
  return consumirEventoUnaVez({
    eventId,
    empresaId,
    consumidor: "CAJA_VENTA_V1",
    aplicar: async ({ evento, session }) => {
      const resultado = await registrarMovimientoDesdeEvento(
        {
          eventName: evento.eventName,
          occurredAt: evento.createdAt,
          payload: evento.payload
        },
        { session, emitirEvento: false }
      );
      if (resultado.ignorado || !resultado.movimiento) {
        throw new Error("CAJA_VENTA_EVENTO_SIN_MOVIMIENTO");
      }
      if (
        String(resultado.movimiento.empresaId) !== String(empresaId) ||
        String(resultado.movimiento.origenId) !== String(evento.aggregateId)
      ) {
        throw new Error("CAJA_VENTA_MOVIMIENTO_IDENTIDAD_INCONSISTENTE");
      }
    }
  });
}

module.exports = { consumirVentaEnCaja };
