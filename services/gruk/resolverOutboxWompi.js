"use strict";

// Enterprise-only wiring. Production is explicitly denied until the durable
// worker, replay, reconciliation and deployment gates have passed.
function resolverOutboxWompi({ env = process.env, registrarEventoEnTransaccion } = {}) {
  if (String(env.NODE_ENV).toLowerCase() === "production") return null;
  if (env.GRUK_WOMPI_DURABLE_OUTBOX_ENABLED !== "true") return null;
  if (typeof registrarEventoEnTransaccion !== "function") {
    throw new Error("WOMPI_OUTBOX_WRITER_NO_CONFIGURADO");
  }
  return registrarEventoEnTransaccion;
}

module.exports = { resolverOutboxWompi };
