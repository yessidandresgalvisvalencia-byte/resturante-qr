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
  const eligibleResults = [];
  let cursor = null;
  const scanSize = Math.min(MAX_BATCH, Math.max(limit, 25));
  // Keyset pagination avoids permanently starving valid deliveries behind
  // arbitrary numbers of stale records from already closed parent events.
  while (eligibleResults.length < limit) {
    const query = {
      empresaId, consumidor,
      $or: [
        { estado: "PENDIENTE" },
        { estado: "PROCESANDO", leaseHasta: { $lte: now } }
      ]
    };
    if (cursor) query._id = { $gt: cursor };
    const candidates = await Entrega.find(query)
      .sort({ _id: 1 }).limit(scanSize).lean();
    if (!candidates.length) break;
    cursor = candidates[candidates.length - 1]._id;
    const events = await Outbox.find({
      _id: { $in: candidates.map(c => c.eventId) },
      empresaId, eventName: "VENTA_COMPLETADA", estado: "PENDIENTE"
    }).select("_id aggregateId payload").lean();
    const eligible = new Set(events.filter(e =>
      String(e.payload?.empresaId) === String(empresaId) &&
      String(e.payload?.ventaId) === String(e.aggregateId)
    ).map(e => String(e._id)));
    for (const c of candidates) {
      if (!eligible.has(String(c.eventId))) continue;
      eligibleResults.push({
        eventId: c.eventId, empresaId: c.empresaId, consumidor: c.consumidor,
        estado: c.estado, intentos: c.intentos, updatedAt: c.updatedAt,
        leaseHasta: c.leaseHasta ?? null
      });
      if (eligibleResults.length === limit) break;
    }
    if (candidates.length < scanSize) break;
  }
  return eligibleResults;
}

module.exports = { listarEntregasRecuperables };
