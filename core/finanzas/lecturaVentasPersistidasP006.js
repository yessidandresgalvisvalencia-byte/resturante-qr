"use strict";

// P0-06: read-only persisted sale evidence. This is NOT a cash/stock reconciliation.
const mongoose = require("mongoose");
const Venta = require("../../models/Venta");

async function readScopedSales({ empresaId, sedeId, limit = 100 }) {
  if (typeof empresaId !== "string" || !/^[a-fA-F0-9]{24}$/.test(empresaId) ||
      typeof sedeId !== "string" || !/^[a-fA-F0-9]{24}$/.test(sedeId)) {
    throw new Error("P006_SCOPE_INVALIDO");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("P006_LIMIT_INVALIDO");
  }
  const filter = {
    empresaId: new mongoose.Types.ObjectId(empresaId),
    sedeId: new mongoose.Types.ObjectId(sedeId)
  };
  // Explicit tenant AND branch filter; no fallback to a global query.
  const rows = await Venta.find(filter)
    .select("_id empresaId sedeId origen origenId estado total fecha metodoPago")
    .sort({ fecha: -1, _id: -1 })
    .limit(limit)
    .lean();
  if (!Array.isArray(rows)) throw new Error("P006_RESPONSE_INVALIDA");
  if (rows.length > limit) throw new Error("P006_RESPONSE_EXCEDE_LIMITE");
  const seen = new Set();
  return rows.map(row => {
    if (!row || typeof row !== "object" || row._id == null ||
        !/^[a-fA-F0-9]{24}$/.test(String(row._id))) {
      throw new Error("P006_ROW_INVALIDA");
    }
    const id = String(row._id).toLowerCase();
    if (seen.has(id)) throw new Error("P006_VENTA_DUPLICADA");
    seen.add(id);
    if (String(row.empresaId) !== empresaId.toLowerCase() ||
        String(row.sedeId) !== sedeId.toLowerCase()) {
      throw new Error("P006_SCOPE_MISMATCH");
    }
    // Legacy Venta.total is Number; do not pass it to an exact-cent ledger.
    return Object.freeze({
      id, empresaId: String(row.empresaId),
      sedeId: String(row.sedeId), origen: row.origen,
      origenId: row.origenId == null ? null : String(row.origenId),
      estado: row.estado, totalLegacy: row.total,
      fecha: row.fecha, metodoPago: row.metodoPago
    });
  });
}

module.exports = { readScopedSales };
