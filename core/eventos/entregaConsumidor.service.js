"use strict";

const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const Entrega = require("../../models/GrukEntregaConsumidor");
const Outbox = require("../../models/GrukOutboxEvent");

const LEASE_MS = 60_000;

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
  const evento = await Outbox.findOne({ _id: eventId, empresaId }).lean();
  if (evento && (evento.eventName !== "VENTA_COMPLETADA" ||
      String(evento.payload?.empresaId) !== String(empresaId) ||
      String(evento.payload?.ventaId) !== String(evento.aggregateId))) {
    throw new Error("ENTREGA_EVENTO_IDENTIDAD_INCONSISTENTE");
  }
  if (!evento) throw new Error("ENTREGA_EVENTO_NO_ENCONTRADO");
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
  }, { returnDocument: "after" }).lean();
  return entrega ? { reclamada: true, leaseToken, entrega } : { reclamada: false };
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
