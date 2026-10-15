"use strict";

const { randomUUID } = require("node:crypto");
const OutboxEvent = require("../../models/GrukOutboxEvent");
const eventBus = require("./eventBus");

const LEASE_MS = 60_000;

// Delivery is at-least-once. Consumers must deduplicate by stable event id.

async function despacharSiguienteVenta({ now = new Date(), emitir = (name, payload, metadata) => {
  if (eventBus.listenerCount(name) === 0) {
    throw new Error("OUTBOX_SIN_CONSUMIDORES_REGISTRADOS");
  }
  return eventBus.emit(name, payload, metadata);
} } = {}) {
  const leaseToken = randomUUID();
  const leaseHasta = new Date(now.getTime() + LEASE_MS);
  const evento = await OutboxEvent.findOneAndUpdate(
    {
      eventName: "VENTA_COMPLETADA",
      $or: [
        { estado: "PENDIENTE" },
        { estado: "PROCESANDO", leaseHasta: { $lte: now } }
      ]
    },
    {
      $set: { estado: "PROCESANDO", leaseHasta, leaseToken },
      $inc: { intentos: 1 }
    },
    { sort: { createdAt: 1 }, new: true }
  ).lean();
  if (!evento) return { procesado: false };

  try {
    await emitir(evento.eventName, evento.payload, {
      eventId: String(evento._id),
      empresaId: String(evento.empresaId),
      aggregateId: String(evento.aggregateId),
      intento: evento.intentos
    });
    const actualizado = await OutboxEvent.updateOne(
      { _id: evento._id, estado: "PROCESANDO", leaseToken },
      { $set: { estado: "ENTREGADO", entregadoAt: new Date(), ultimoError: "" },
        $unset: { leaseHasta: "", leaseToken: "" } }
    );
    return { procesado: true, entregado: actualizado.modifiedCount === 1, eventoId: evento._id };
  } catch (error) {
    await OutboxEvent.updateOne(
      { _id: evento._id, estado: "PROCESANDO", leaseToken },
      { $set: { estado: "PENDIENTE", ultimoError: String(error?.message || error).slice(0, 500) },
        $unset: { leaseHasta: "", leaseToken: "" } }
    );
    throw error;
  }
}

module.exports = { despacharSiguienteVenta };
