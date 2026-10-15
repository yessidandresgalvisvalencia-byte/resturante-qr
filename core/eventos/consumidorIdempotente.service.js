"use strict";

const mongoose = require("mongoose");
const OutboxEvent = require("../../models/GrukOutboxEvent");
const EventoProcesado = require("../../models/GrukEventoProcesado");

/**
 * Executes a consumer's MongoDB effects and receipt in the same transaction.
 * Consumers must use the provided session for EVERY database write.
 * No external network effects may be performed inside this callback.
 */
async function consumirEventoUnaVez({ eventId, empresaId, consumidor, aplicar }) {
  if (!mongoose.isValidObjectId(eventId) || !mongoose.isValidObjectId(empresaId)) {
    throw new Error("CONSUMIDOR_IDENTIDAD_INVALIDA");
  }
  if (typeof consumidor !== "string" || !consumidor.trim() || typeof aplicar !== "function") {
    throw new Error("CONSUMIDOR_CONFIGURACION_INVALIDA");
  }
  const session = await mongoose.startSession();
  let aplicado = false;
  try {
    await session.withTransaction(async () => {
      aplicado = false;
      const evento = await OutboxEvent.findOne({
        _id: eventId, empresaId
      }).session(session).lean();
      if (!evento) throw new Error("CONSUMIDOR_EVENTO_NO_ENCONTRADO");
      const existente = await EventoProcesado.findOne({
        consumidor, eventId: evento._id
      }).session(session).lean();
      if (existente) return;
      await aplicar({ evento, session });
      await EventoProcesado.create([{
        empresaId, consumidor, eventId: evento._id
      }], { session });
      aplicado = true;
    });
    return { aplicado, duplicado: !aplicado };
  } finally {
    await session.endSession();
  }
}

module.exports = { consumirEventoUnaVez };
