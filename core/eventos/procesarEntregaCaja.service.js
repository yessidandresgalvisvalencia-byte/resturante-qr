"use strict";

const { reclamarEntrega, confirmarEntrega, liberarEntrega } =
  require("./entregaConsumidor.service");
const { consumirVentaEnCaja } = require("./cajaVenta.consumer");

const CONSUMIDOR = "CAJA_VENTA_V1";

/**
 * Explicit invocation only. Never acknowledges the shared outbox record.
 * Caja effects and idempotency receipt are committed in a separate ACID
 * transaction before the consumer-specific delivery can be acknowledged.
 */
async function procesarEntregaCaja({ eventId, empresaId }) {
  const claim = await reclamarEntrega({ eventId, empresaId, consumidor: CONSUMIDOR });
  if (!claim.reclamada) return { procesado: false, motivo: "NO_RECLAMABLE" };
  const leaseToken = claim.leaseToken;
  try {
    const consumo = await consumirVentaEnCaja({ eventId, empresaId });
    if (!consumo.aplicado && !consumo.duplicado) {
      throw new Error("CAJA_CONSUMO_SIN_CONFIRMACION");
    }
    const ack = await confirmarEntrega({
      eventId, empresaId, consumidor: CONSUMIDOR, leaseToken
    });
    if (!ack.confirmado) {
      // The ACID effect may already exist; a new lease owner must retry and
      // reconcile via the durable idempotency receipt, not execute it twice.
      throw new Error("CAJA_ENTREGA_LEASE_PERDIDO");
    }
    return { procesado: true, aplicado: consumo.aplicado, duplicado: consumo.duplicado };
  } catch (error) {
    await liberarEntrega({
      eventId, empresaId, consumidor: CONSUMIDOR, leaseToken, error
    });
    throw error;
  }
}

module.exports = { procesarEntregaCaja };
