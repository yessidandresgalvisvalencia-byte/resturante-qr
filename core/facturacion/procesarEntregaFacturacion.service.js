"use strict";

const { reclamarEntrega, confirmarEntrega, liberarEntrega } =
  require("../eventos/entregaConsumidor.service");
const { consumirVentaEnFacturacion } = require("./facturacionVenta.consumer");

const CONSUMIDOR = "FACTURACION_VENTA_V1";

async function procesarEntregaFacturacion({ eventId, empresaId }) {
  const claim = await reclamarEntrega({ eventId, empresaId, consumidor: CONSUMIDOR });
  if (!claim.reclamada) return { procesado: false, motivo: "NO_RECLAMABLE" };
  const leaseToken = claim.leaseToken;
  try {
    const consumo = await consumirVentaEnFacturacion({ eventId, empresaId });
    if (!consumo.aplicado && !consumo.duplicado) {
      throw new Error("FACTURACION_CONSUMO_SIN_CONFIRMACION");
    }
    const ack = await confirmarEntrega({
      eventId, empresaId, consumidor: CONSUMIDOR, leaseToken
    });
    if (!ack.confirmado) throw new Error("FACTURACION_ENTREGA_LEASE_PERDIDO");
    return { procesado: true, aplicado: consumo.aplicado, duplicado: consumo.duplicado };
  } catch (error) {
    try {
      await liberarEntrega({ eventId, empresaId, consumidor: CONSUMIDOR, leaseToken, error });
    } catch (liberacionError) {
      error.cause = error.cause || liberacionError;
    }
    throw error;
  }
}

module.exports = { procesarEntregaFacturacion };
