"use strict";

const { randomUUID } = require("node:crypto");
const OutboxEvent = require("../../models/GrukOutboxEvent");
const eventBus = require("./eventBus");

const LEASE_MS = 60_000;

// Delivery is at-least-once. Consumers must deduplicate by stable event id.

async function despacharSiguienteVenta({ now = new Date(), emitir = async (name, payload, metadata) => {
  const consumidores = eventBus.rawListeners(name);
  if (consumidores.length === 0) {
    throw new Error("OUTBOX_SIN_CONSUMIDORES_REGISTRADOS");
  }
  // A once() listener is removed on its first invocation; a retry would lose it.
  // Durable outbox consumers must stay subscribed across retries.
  if (consumidores.some(listener => typeof listener.listener === "function")) {
    throw new Error("OUTBOX_CONSUMIDOR_ONCE_NO_PERMITIDO");
  }
  const envelope = Object.freeze({
    eventName: name,
    occurredAt: new Date(),
    payload,
    metadata: Object.freeze({ ...metadata })
  });
  // Await every listener: EventEmitter.emit() does not await async handlers.
  // A failure leaves the outbox pending; all consumers must be idempotent.
  const resultados = await Promise.allSettled(
    consumidores.map(listener => Promise.resolve().then(() => listener.call(eventBus, envelope)))
  );
  const fallido = resultados.find(resultado => resultado.status === "rejected");
  if (fallido) throw fallido.reason;
  if (resultados.some(resultado => resultado.status === "fulfilled" && resultado.value === false)) {
    throw new Error("OUTBOX_CONSUMIDOR_RECHAZO_ENTREGA");
  }
  return true;
} } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError("OUTBOX_FECHA_INVALIDA");
  }
  if (typeof emitir !== "function") {
    throw new TypeError("OUTBOX_EMISOR_INVALIDO");
  }
  // Prevent invalid lease timestamps at the JavaScript Date boundaries.
  if (!Number.isFinite(now.getTime() + LEASE_MS) ||
      !Number.isFinite(new Date(now.getTime() + LEASE_MS).getTime())) {
    throw new RangeError("OUTBOX_LEASE_FECHA_FUERA_DE_RANGO");
  }
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
    const confirmacion = await emitir(evento.eventName, evento.payload, {
      eventId: String(evento._id),
      empresaId: String(evento.empresaId),
      aggregateId: String(evento.aggregateId),
      intento: evento.intentos
    });
    if (confirmacion === false) {
      throw new Error("OUTBOX_ENTREGA_NO_CONFIRMADA");
    }
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
