"use strict";

const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const Entrega = require("../../models/GrukEntregaConsumidor");
const Outbox = require("../../models/GrukOutboxEvent");

const LEASE_MS = 60_000;
const MAX_CLAIM_ATTEMPTS = 3;

function isTransientWriteConflict(error) {
  return typeof error?.hasErrorLabel === "function" &&
    error.hasErrorLabel("TransientTransactionError");
}

async function reclamarEntrega({ eventId, empresaId, consumidor, now = new Date() }) {
  if (!mongoose.isValidObjectId(eventId) || !mongoose.isValidObjectId(empresaId)) {
    throw new Error("ENTREGA_IDENTIDAD_INVALIDA");
  }
  if (typeof consumidor !== "string" || !consumidor.trim()) {
    throw new Error("ENTREGA_CONSUMIDOR_INVALIDO");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("ENTREGA_FECHA_INVALIDA");
  }
  for (let attempt = 1; attempt <= MAX_CLAIM_ATTEMPTS; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
      const evento = await Outbox.findOne({ _id: eventId, empresaId })
        .session(session).lean();
      if (evento && (evento.eventName !== "VENTA_COMPLETADA" ||
          String(evento.payload?.empresaId) !== String(empresaId) ||
          String(evento.payload?.ventaId) !== String(evento.aggregateId))) {
        throw new Error("ENTREGA_EVENTO_IDENTIDAD_INCONSISTENTE");
      }
      if (!evento) throw new Error("ENTREGA_EVENTO_NO_ENCONTRADO");
      if (evento.estado !== "PENDIENTE") return { reclamada: false };
      const leaseToken = randomUUID();
      const leaseHasta = new Date(now.getTime() + LEASE_MS);
      if (!Number.isFinite(leaseHasta.getTime())) throw new Error("ENTREGA_LEASE_INVALIDO");
      const entrega = await Entrega.findOneAndUpdate({
        eventId, empresaId, consumidor,
        $or: [
          { estado: "PENDIENTE" },
          { estado: "PROCESANDO", leaseHasta: { $lte: now } }
        ]
      }, {
        $set: { estado: "PROCESANDO", leaseToken, leaseHasta },
        $inc: { intentos: 1 }
      }, { session, returnDocument: "after" }).lean();
      if (!entrega) return { reclamada: false };
      // Parent write fence: closing or registering a consumer must conflict
      // with this claim rather than commit from an obsolete parent snapshot.
      const fence = await Outbox.updateOne({
        _id: eventId, empresaId, estado: "PENDIENTE",
        registroVersion: evento.registroVersion || 0
      }, { $inc: { registroVersion: 1 } }, { session });
      if (fence.modifiedCount !== 1) {
        throw new Error("ENTREGA_EVENTO_VERSION_CONFLICTO");
      }
      return { reclamada: true, leaseToken, entrega };
      });
    } catch (error) {
      if (!isTransientWriteConflict(error)) throw error;
      if (attempt === MAX_CLAIM_ATTEMPTS) {
        throw new Error("ENTREGA_RECLAMACION_CONFLICTO_AGOTADO", { cause: error });
      }
    } finally {
      await session.endSession();
    }
  }
}

async function confirmarEntrega({ eventId, empresaId, consumidor, leaseToken, now = new Date() }) {
  if (!mongoose.isValidObjectId(eventId) || !mongoose.isValidObjectId(empresaId) ||
      typeof consumidor !== "string" || !consumidor.trim() ||
      typeof leaseToken !== "string" || !leaseToken.trim() ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("ENTREGA_CONFIRMACION_INVALIDA");
  }
  const resultado = await Entrega.updateOne({
    eventId, empresaId, consumidor, estado: "PROCESANDO", leaseToken,
    leaseHasta: { $gt: now }
  }, {
    $set: { estado: "ENTREGADO", entregadoAt: now, ultimoError: "" },
    $unset: { leaseToken: "", leaseHasta: "" }
  });
  return { confirmado: resultado.modifiedCount === 1 };
}

async function liberarEntrega({ eventId, empresaId, consumidor, leaseToken, error }) {
  if (!mongoose.isValidObjectId(eventId) || !mongoose.isValidObjectId(empresaId) ||
      typeof consumidor !== "string" || !consumidor.trim() ||
      typeof leaseToken !== "string" || !leaseToken.trim()) {
    throw new Error("ENTREGA_LIBERACION_INVALIDA");
  }
  const resultado = await Entrega.updateOne({
    eventId, empresaId, consumidor, estado: "PROCESANDO", leaseToken
  }, {
    $set: { estado: "PENDIENTE", ultimoError: String(error?.message || error || "").slice(0, 500) },
    $unset: { leaseToken: "", leaseHasta: "" }
  });
  return { liberado: resultado.modifiedCount === 1 };
}

module.exports = { reclamarEntrega, confirmarEntrega, liberarEntrega };
