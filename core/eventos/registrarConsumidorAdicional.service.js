"use strict";

const mongoose = require("mongoose");
const Outbox = require("../../models/GrukOutboxEvent");
const Entrega = require("../../models/GrukEntregaConsumidor");

/**
 * All additional consumers MUST register through this function before the
 * parent event is closed. Writing the parent document creates a write
 * conflict with concurrent closure transactions.
 */
async function registrarConsumidorAdicional({ eventId, empresaId, consumidor }) {
  if (!mongoose.isValidObjectId(eventId) || !mongoose.isValidObjectId(empresaId) ||
      typeof consumidor !== "string" || !/^[A-Z][A-Z0-9_]{2,79}$/.test(consumidor)) {
    throw new Error("OUTBOX_REGISTRO_CONSUMIDOR_INVALIDO");
  }
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const event = await Outbox.findOne({
        _id: eventId, empresaId, eventName: "VENTA_COMPLETADA",
        estado: "PENDIENTE"
      }).session(session).lean();
      if (!event || String(event.payload?.empresaId) !== String(empresaId) ||
          String(event.payload?.ventaId) !== String(event.aggregateId)) {
        throw new Error("OUTBOX_REGISTRO_EVENTO_NO_PENDIENTE");
      }
      const existingBeforeFence = await Entrega.findOne({
        empresaId, eventId, consumidor
      }).session(session).lean();
      if (existingBeforeFence) return { registrada: false, existente: true };
      const touch = await Outbox.updateOne({
        _id: eventId, empresaId, estado: "PENDIENTE"
      }, { $inc: { registroVersion: 1 } }, { session });
      if (touch.modifiedCount !== 1) {
        throw new Error("OUTBOX_REGISTRO_EVENTO_NO_PENDIENTE");
      }
      const existing = await Entrega.findOne({
        empresaId, eventId, consumidor
      }).session(session).lean();
      if (existing) return { registrada: false, existente: true };
      await Entrega.create([{ empresaId, eventId, consumidor }], { session });
      return { registrada: true };
    });
  } finally {
    await session.endSession();
  }
}

module.exports = { registrarConsumidorAdicional };
