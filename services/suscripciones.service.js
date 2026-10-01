"use strict";
const mongoose = require("mongoose");
const Restaurante = require("../models/restaurante");
const IntentoCobroSuscripcion = require("../models/IntentoCobroSuscripcion");

function siguienteCobroMensual(desde) {
  const base = new Date(desde);
  const day = base.getUTCDate();
  const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1,
    base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds(), base.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

async function aplicarResultadoSuscripcion({ transaction }) {
  const reference = String(transaction?.reference || "");
  if (!reference.startsWith("suscripcion_") && !reference.startsWith("renovacion_")) {
    return { handled: false };
  }

  const intento = await IntentoCobroSuscripcion.findOne({ reference });
  let restaurante = null;
  if (intento) {
    restaurante = await Restaurante.findOne({ restaurantId: intento.restaurantId });
  } else if (reference.startsWith("suscripcion_")) {
    const raw = reference.slice("suscripcion_".length);
    const cut = raw.lastIndexOf("_");
    if (cut > 0) restaurante = await Restaurante.findOne({ restaurantId: raw.slice(0, cut) });
  }
  if (!restaurante) return { handled: true, ok: false, reason: "RESTAURANTE_NO_ENCONTRADO" };

  const amountExpected = intento?.amountInCents ?? Math.round(Number(restaurante.precioMensual || 0) * 100);
  if (Number(transaction.amount_in_cents) !== Number(amountExpected) ||
      String(transaction.currency || "").toUpperCase() !== "COP") {
    console.error("[SEGURIDAD] Resultado de suscripción con integridad económica inválida", {
      reference, transactionId: String(transaction.id || "")
    });
    return { handled: true, ok: false, reason: "INTEGRIDAD_ECONOMICA_INVALIDA" };
  }

  const status = String(transaction.status || "").toUpperCase();
  const transactionId = String(transaction.id || "");
  if (restaurante.ultimoTransactionId === transactionId && transactionId) {
    return { handled: true, ok: true, idempotent: true, status };
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const r = await Restaurante.findById(restaurante._id).session(session);
      if (!r) throw new Error("RESTAURANTE_NO_ENCONTRADO");
      if (r.ultimoTransactionId === transactionId && transactionId) return;

      if (intento) {
        const i = await IntentoCobroSuscripcion.findById(intento._id).session(session);
        if (i) {
          i.transactionId = transactionId;
          if (status === "APPROVED") i.estado = "APROBADO";
          else if (status === "PENDING") i.estado = "PENDIENTE";
          else if (["DECLINED","ERROR","VOIDED"].includes(status)) i.estado = "RECHAZADO";
          if (["APPROVED","DECLINED","ERROR","VOIDED"].includes(status)) i.resueltoAt = new Date();
          await i.save({ session });
        }
      }

      if (status === "APPROVED") {
        const paidAt = new Date();
        r.estadoSuscripcion = "activa";
        r.fechaUltimoPago = paidAt;
        r.fechaProximoCobro = siguienteCobroMensual(paidAt);
        r.ultimoTransactionId = transactionId;
        await r.save({ session });
      } else if (["DECLINED","ERROR","VOIDED"].includes(status)) {
        r.estadoSuscripcion = "pendiente";
        r.ultimoTransactionId = transactionId;
        await r.save({ session });
      }
    });
    return { handled: true, ok: true, status };
  } finally {
    await session.endSession();
  }
}

module.exports = { aplicarResultadoSuscripcion, siguienteCobroMensual };
