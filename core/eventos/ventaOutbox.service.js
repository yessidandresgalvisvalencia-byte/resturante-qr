"use strict";

const OutboxEvent = require("../../models/GrukOutboxEvent");
const EntregaConsumidor = require("../../models/GrukEntregaConsumidor");

/**
 * Must be invoked inside the same MongoDB transaction as the sale.
 * The unique event/aggregate index prevents two durable records for one sale.
 */
async function registrarVentaEnOutbox(venta, session) {
  if (!session) throw new Error("OUTBOX_REQUIERE_SESION");
  if (!venta?._id || !venta?.empresaId) throw new Error("OUTBOX_VENTA_INVALIDA");
  const payload = {
    ventaId: venta._id,
    empresaId: venta.empresaId,
    sedeId: venta.sedeId || null,
    productoServicioId: venta.productoServicioId || null,
    clienteId: venta.clienteId || null,
    origen: venta.origen,
    origenId: venta.origenId || null,
    cantidad: venta.cantidad,
    precioUnitario: venta.precioUnitario,
    total: venta.total,
    costoUnitario: venta.costoUnitario,
    costoTotal: venta.costoTotal,
    utilidadBruta: venta.utilidadBruta,
    margenBruto: venta.margenBruto,
    metodoPago: venta.metodoPago,
    concepto: venta.concepto,
    fecha: venta.fecha,
    sourceUpdatedAt: venta.updatedAt,
    cajaReferencia: venta.metadata?.cajaReferencia || null
  };
  const [event] = await OutboxEvent.create([{
    empresaId: venta.empresaId,
    eventName: "VENTA_COMPLETADA",
    aggregateId: venta._id,
    payload
  }], { session });
  await EntregaConsumidor.create([
    { empresaId: venta.empresaId, eventId: event._id, consumidor: "CAJA_VENTA_V1" },
    { empresaId: venta.empresaId, eventId: event._id, consumidor: "FACTURACION_VENTA_V1" }
  ], { session });
  return event;
}

module.exports = { registrarVentaEnOutbox };
