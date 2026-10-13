"use strict";

const { crearEventoVentaCompletada } = require("./crearEventoVentaCompletada");

// The caller supplies the already-open MongoDB transaction and durable Outbox
// writer. No Socket.IO or in-process EventEmitter is invoked here.
async function registrarVentaEnOutbox({ venta, session, registrarEventoEnTransaccion }) {
  if (!session || typeof session.inTransaction !== "function" || !session.inTransaction()) {
    throw new Error("VENTA_OUTBOX_TRANSACCION_OBLIGATORIA");
  }
  if (typeof registrarEventoEnTransaccion !== "function") {
    throw new Error("VENTA_OUTBOX_WRITER_OBLIGATORIO");
  }
  const evento = crearEventoVentaCompletada(venta);
  await registrarEventoEnTransaccion(evento, session);
  return evento.eventId;
}

module.exports = { registrarVentaEnOutbox };
