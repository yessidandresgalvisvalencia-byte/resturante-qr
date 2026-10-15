"use strict";

const mongoose = require("mongoose");
const Outbox = require("../../models/GrukOutboxEvent");
const Entrega = require("../../models/GrukEntregaConsumidor");

const OBLIGATORIOS = Object.freeze(["CAJA_VENTA_V1", "FACTURACION_VENTA_V1"]);

/**
 * Marks a sale event delivered only when both mandatory consumer receipts
 * are durable. It does not dispatch work or perform any external effect.
 * The transactional read/write prevents a partial consumer ACK from
 * globally completing an event.
 */
async function cerrarVentaEntregada({ eventId, empresaId }) {
  if (!mongoose.isValidObjectId(eventId) || !mongoose.isValidObjectId(empresaId)) {
    throw new Error("OUTBOX_CIERRE_IDENTIDAD_INVALIDA");
  }
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const event = await Outbox.findOne({ _id: eventId, empresaId }).session(session).lean();
      if (!event || event.eventName !== "VENTA_COMPLETADA" ||
          String(event.payload?.empresaId) !== String(empresaId) ||
          String(event.payload?.ventaId) !== String(event.aggregateId)) {
        throw new Error("OUTBOX_CIERRE_EVENTO_INVALIDO");
      }
      if (event.estado === "ENTREGADO") return { cerrado: false, yaEntregado: true };
      if (event.estado !== "PENDIENTE") return { cerrado: false, motivo: "EVENTO_NO_PENDIENTE" };
      // Fence concurrent consumer registration against this closure transaction.
      // Every supported registration updates registroVersion on the parent.
      const versionFence = await Outbox.updateOne({
        _id: eventId, empresaId, estado: "PENDIENTE",
        registroVersion: event.registroVersion || 0
      }, { $inc: { registroVersion: 1 } }, { session });
      if (versionFence.modifiedCount !== 1) {
        throw new Error("OUTBOX_CIERRE_VERSION_CONFLICTO");
      }
      const entregas = await Entrega.find({ empresaId, eventId }).session(session).lean();
      if (entregas.length < OBLIGATORIOS.length ||
          !OBLIGATORIOS.every(name =>
            entregas.some(e => e.consumidor === name && e.estado === "ENTREGADO")) ||
          entregas.some(e => e.estado !== "ENTREGADO")) {
        return { cerrado: false, motivo: "CONSUMIDORES_PENDIENTES" };
      }
      const result = await Outbox.updateOne({
        _id: eventId, empresaId, estado: "PENDIENTE"
      }, {
        $set: { estado: "ENTREGADO", entregadoAt: new Date(), ultimoError: "" },
        $unset: { leaseHasta: "", leaseToken: "" }
      }, { session });
      return { cerrado: result.modifiedCount === 1 };
    });
  } finally {
    await session.endSession();
  }
}

module.exports = { cerrarVentaEntregada };
