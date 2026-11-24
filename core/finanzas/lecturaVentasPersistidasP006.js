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
  // Fail closed on sparse arrays, inherited indices and accessor-backed evidence.
  const seen = new Set();
  const output = [];
  for (let index = 0; index < rows.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(rows, String(index));
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      throw new Error("P006_RESPONSE_INVALIDA");
    }
    const row = descriptor.value;
    if (!row || typeof row !== "object") throw new Error("P006_ROW_INVALIDA");
    // Lean records are untrusted evidence: never invoke accessors or inherited fields.
    const fields = ["_id", "empresaId", "sedeId", "origen", "origenId", "estado", "total", "fecha", "metodoPago"];
    const safe = Object.create(null);
    for (const field of fields) {
      const own = Object.getOwnPropertyDescriptor(row, field);
      if (own && !Object.prototype.hasOwnProperty.call(own, "value")) {
        throw new Error("P006_ROW_INVALIDA");
      }
      safe[field] = own ? own.value : undefined;
    }
    if (safe._id == null ||
        !/^[a-fA-F0-9]{24}$/.test(String(safe._id))) {
      throw new Error("P006_ROW_INVALIDA");
    }
    const id = String(safe._id).toLowerCase();
    if (seen.has(id)) throw new Error("P006_VENTA_DUPLICADA");
    seen.add(id);
    if (String(safe.empresaId) !== empresaId.toLowerCase() ||
        String(safe.sedeId) !== sedeId.toLowerCase()) {
      throw new Error("P006_SCOPE_MISMATCH");
    }
    // Legacy Venta.total is Number; do not pass it to an exact-cent ledger.
    output.push(Object.freeze({
      id, empresaId: String(safe.empresaId),
      sedeId: String(safe.sedeId), origen: safe.origen,
      origenId: safe.origenId == null ? null : String(safe.origenId),
      estado: safe.estado, totalLegacy: safe.total,
      fecha: safe.fecha, metodoPago: safe.metodoPago
    }));
  }
  return output;
}

module.exports = { readScopedSales };
