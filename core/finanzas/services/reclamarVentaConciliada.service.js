"use strict";

const mongoose = require("mongoose");
const Venta = require("../../../models/Venta");
const { conciliarVentaCajaLedger } = require("./conciliarVentaCajaLedger.service");

/**
 * Fail-closed prerequisite for a future financial command executor.
 * This does NOT authorize execution until every reversal writer participates
 * in the same CAS protocol. Never expose this helper directly as an API.
 */
async function reclamarVentaConciliada({
  empresaId, sedeId, ventaId, session, token
} = {}) {
  if (!session || !session.inTransaction() ||
      session.client !== mongoose.connection.getClient()) {
    throw new Error("ORDEN_FINANCIERA_TRANSACCION_REQUERIDA");
  }
  if (![empresaId, sedeId, ventaId].every(mongoose.isValidObjectId)) {
    throw new Error("ORDEN_FINANCIERA_IDENTIDAD_INVALIDA");
  }
  if (typeof token !== "string" || !/^[a-zA-Z0-9:_-]{16,128}$/.test(token)) {
    throw new Error("ORDEN_FINANCIERA_TOKEN_INVALIDO");
  }
  const resultado = await conciliarVentaCajaLedger({
    empresaId, sedeId, ventaId, session
  });
  if (!resultado.conciliada || resultado.estado !== "CONCILIADA") {
    throw new Error("ORDEN_FINANCIERA_NO_CONCILIADA");
  }
  // Force a write conflict against other participants writing the same Venta.
  // This is only a prerequisite; it cannot serialize legacy reversal writers.
  const venta = await Venta.findOneAndUpdate({
    _id: ventaId, empresaId, sedeId, estado: "pagada",
    "grukControlFinanciero.token": { $exists: false }
  }, {
    $set: { "grukControlFinanciero.token": token }
  }, { session, returnDocument: "after", strict: false });
  if (!venta) throw new Error("ORDEN_FINANCIERA_CONFLICTO_CONCURRENCIA");
  return { ventaId: venta._id, token, conciliada: true };
}

module.exports = { reclamarVentaConciliada };
