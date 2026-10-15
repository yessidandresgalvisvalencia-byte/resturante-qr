"use strict";

// Contrato de evento para migrar el flujo de ventas al Outbox.
// Función pura: no emite eventos ni realiza escrituras.
function crearEventoVentaCompletada(venta) {
  const id = String(venta?._id || "");
  const empresaId = String(venta?.empresaId || "");
  const origenId = String(venta?.origenId || "");
  if (!/^[0-9a-f]{24}$/i.test(id) ||
      !/^[0-9a-f]{24}$/i.test(empresaId) ||
      !/^[0-9a-f]{24}$/i.test(origenId) ||
      venta?.origen !== "restaurante" ||
      venta?.estado !== "pagada" ||
      venta?.metodoPago !== "tarjeta" ||
      !Number.isSafeInteger(venta?.total) || venta.total <= 0 ||
      venta.total > Math.floor(Number.MAX_SAFE_INTEGER / 100) ||
      !String(venta?.metadata?.restaurantId || "").trim()) {
    throw new Error("VENTA_OUTBOX_INVALIDA");
  }
  const sedeId = venta.sedeId == null ? null : String(venta.sedeId);
  if (sedeId !== null && !/^[0-9a-f]{24}$/i.test(sedeId)) {
    throw new Error("VENTA_OUTBOX_SEDE_INVALIDA");
  }
  return {
    eventId: "VENTA_COMPLETADA:" + id.toLowerCase(),
    empresaId: empresaId.toLowerCase(),
    sedeId: sedeId?.toLowerCase() || null,
    eventName: "VENTA_COMPLETADA",
    aggregateId: id.toLowerCase(),
    payload: {
      ventaId: id.toLowerCase(),
      restaurantId: String(venta.metadata.restaurantId),
      total: venta.total
    }
  };
}

module.exports = { crearEventoVentaCompletada };
