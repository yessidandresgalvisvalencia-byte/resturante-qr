"use strict";

const mongoose = require("mongoose");
const Entrega = require("../../models/GrukEntregaConsumidor");
const { evaluarReintentoEntrega } = require("./politicaReintentoEntrega");

const CONSUMIDORES = Object.freeze(["CAJA_VENTA_V1", "FACTURACION_VENTA_V1"]);
const MAX_LIMIT = 100;

/**
 * Read-only triage. Does not dispatch, mutate delivery state, or turn
 * advisory quarantine into an unreviewed destructive transition.
 */
async function diagnosticarReintentosEntrega({
  empresaId, consumidor, now = new Date(), limit = 25
}) {
  if (!mongoose.isValidObjectId(empresaId) ||
      !CONSUMIDORES.includes(consumidor) ||
      !(now instanceof Date) || !Number.isFinite(now.getTime()) ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error("ENTREGA_DIAGNOSTICO_PARAMETROS_INVALIDOS");
  }
  const entregas = await Entrega.find({
    empresaId, consumidor, estado: { $in: ["PENDIENTE", "PROCESANDO"] }
  }).sort({ _id: 1 }).limit(limit).select(
    "eventId estado intentos leaseHasta updatedAt"
  ).lean();
  return {
    empresaId: String(empresaId),
    consumidor,
    calculadoAt: now.toISOString(),
    examinadas: entregas.length,
    diagnosticos: entregas.map(entrega => {
      const evaluacion = evaluarReintentoEntrega({
        intentos: entrega.intentos ?? 0,
        estado: entrega.estado,
        leaseHasta: entrega.leaseHasta ?? null,
        now
      });
      // Never recommend a retry before either the cooldown or the old
      // processing lease expires. The claim service remains authoritative.
      const eligibleAt = evaluacion.accion === "REINTENTAR"
        ? new Date(Math.max(
          new Date(entrega.updatedAt).getTime() + evaluacion.delayMs,
          entrega.estado === "PROCESANDO" && entrega.leaseHasta
            ? new Date(entrega.leaseHasta).getTime() : 0
        ))
        : null;
      return {
        eventId: String(entrega.eventId),
        estado: entrega.estado,
        intentos: entrega.intentos ?? 0,
        accion: evaluacion.accion,
        motivo: evaluacion.motivo ?? null,
        eligibleAt: eligibleAt?.toISOString() ?? null,
        listoAhora: evaluacion.accion === "REINTENTAR" &&
          eligibleAt.getTime() <= now.getTime()
      };
    })
  };
}

module.exports = { diagnosticarReintentosEntrega };
