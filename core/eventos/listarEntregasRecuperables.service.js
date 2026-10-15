"use strict";

const mongoose = require("mongoose");
const Entrega = require("../../models/GrukEntregaConsumidor");
const Outbox = require("../../models/GrukOutboxEvent");

const CONSUMIDORES = Object.freeze(["CAJA_VENTA_V1", "FACTURACION_VENTA_V1"]);
const MAX_BATCH = 100;

/**
 * Read-only discovery. This does not claim leases, dispatch side effects or
 * acknowledge either a consumer delivery or its shared outbox event.
 */
async function listarEntregasRecuperables({
  empresaId, consumidor, now = new Date(), limit = 25
}) {
  if (!mongoose.isValidObjectId(empresaId) ||
      !CONSUMIDORES.includes(consumidor) ||
      !(now instanceof Date) || !Number.isFinite(now.getTime()) ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH) {
    throw new Error("ENTREGA_RECUPERACION_PARAMETROS_INVALIDOS");
  }
  const candidates = await Entrega.find({
    empresaId, consumidor,
    $or: [
      { estado: "PENDIENTE" },
      { estado: "PROCESANDO", leaseHasta: { $lte: now } }
    ]
  }).sort({ updatedAt: 1, _id: 1 }).limit(limit).lean();
  if (!candidates.length) return [];
  const eventIds = candidates.map(c => c.eventId);
  const events = await Outbox.find({
    _id: { $in: eventIds }, empresaId,
    eventName: "VENTA_COMPLETADA", estado: "PENDIENTE"
  }).select("_id aggregateId payload").lean();
  const eligible = new Set(events.filter(e =>
    String(e.payload?.empresaId) === String(empresaId) &&
    String(e.payload?.ventaId) === String(e.aggregateId)
  ).map(e => String(e._id)));
  return candidates.filter(c => eligible.has(String(c.eventId))).map(c => ({
    eventId: c.eventId, empresaId: c.empresaId, consumidor: c.consumidor,
    estado: c.estado, intentos: c.intentos
  }));
}

module.exports = { listarEntregasRecuperables };
