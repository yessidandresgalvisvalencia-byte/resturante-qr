"use strict";

const mongoose = require("mongoose");
const Outbox = require("../../models/GrukOutboxEvent");
const { cerrarVentaEntregada } = require("./cerrarVentaEntregada.service");

const MAX_BATCH = 100;

/**
 * Explicit reconciliation of pending parent events after consumer ACKs.
 * This closes the crash window between the last consumer ACK and parent close.
 * The closure service independently validates every required delivery.
 */
async function reconciliarCierresPendientes({ empresaId, limit = 25 }) {
  if (!mongoose.isValidObjectId(empresaId) ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH) {
    throw new Error("OUTBOX_RECONCILIACION_PARAMETROS_INVALIDOS");
  }
  const events = await Outbox.find({
    empresaId, eventName: "VENTA_COMPLETADA", estado: "PENDIENTE"
  }).sort({ createdAt: 1, _id: 1 }).limit(limit)
    .select("_id").lean();
  const resultados = [];
  for (const event of events) {
    try {
      const result = await cerrarVentaEntregada({ empresaId, eventId: event._id });
      resultados.push({ eventId: event._id, ok: true, ...result });
    } catch (error) {
      resultados.push({
        eventId: event._id, ok: false,
        codigo: String(error?.code || error?.message || "OUTBOX_RECONCILIACION_FALLO").slice(0, 160)
      });
    }
  }
  return { examinados: events.length, resultados };
}

module.exports = { reconciliarCierresPendientes };
