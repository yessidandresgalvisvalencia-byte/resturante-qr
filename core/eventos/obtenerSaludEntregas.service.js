"use strict";

const mongoose = require("mongoose");
const Entrega = require("../../models/GrukEntregaConsumidor");

const CONSUMIDORES = Object.freeze(["CAJA_VENTA_V1", "FACTURACION_VENTA_V1"]);

/**
 * Read-only operational snapshot. No claim, retry, ACK or state mutation.
 * Counts are scoped to a single company; callers must enforce authorization.
 */
async function obtenerSaludEntregas({ empresaId, now = new Date() }) {
  if (!mongoose.isValidObjectId(empresaId) ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("ENTREGA_SALUD_PARAMETROS_INVALIDOS");
  }
  const counts = await Entrega.aggregate([
    { $match: { empresaId: new mongoose.Types.ObjectId(String(empresaId)),
      consumidor: { $in: CONSUMIDORES } } },
    { $group: { _id: { consumidor: "$consumidor", estado: "$estado" },
      total: { $sum: 1 },
      expirados: { $sum: { $cond: [
        { $and: [
          { $eq: ["$estado", "PROCESANDO"] },
          { $lte: ["$leaseHasta", now] }
        ] }, 1, 0
      ] } },
      reintentos: { $sum: { $cond: [{ $gt: ["$intentos", 1] }, 1, 0] } }
    } }
  ]);
  const consumidores = Object.fromEntries(CONSUMIDORES.map(consumidor => [
    consumidor, { PENDIENTE: 0, PROCESANDO: 0, ENTREGADO: 0, expirados: 0, reintentos: 0 }
  ]));
  for (const item of counts) {
    const row = consumidores[item._id.consumidor];
    if (!row || !Object.hasOwn(row, item._id.estado)) {
      throw new Error("ENTREGA_SALUD_ESTADO_DESCONOCIDO");
    }
    row[item._id.estado] = item.total;
    row.expirados += item.expirados;
    row.reintentos += item.reintentos;
  }
  return { empresaId: String(empresaId), calculadoAt: now.toISOString(), consumidores };
}

module.exports = { obtenerSaludEntregas };
