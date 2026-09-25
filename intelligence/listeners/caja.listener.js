"use strict";

const eventBus = require("../../core/eventos/eventBus");
const {
  TIPOS_SOPORTADOS,
  registrarMovimientoDesdeEvento
} = require("../../core/finanzas/caja.service");

let registrado = false;

const colas = new Map();

function claveEvento(event) {
  const payload =
    event?.payload || {};

  const origenId =
    payload.ventaId ||
    payload.compraId ||
    payload.gastoId ||
    "SIN_ORIGEN";

  return [
    event?.eventName || "EVENTO",
    String(origenId)
  ].join(":");
}

function encolar(event) {
  const key =
    claveEvento(event);

  const anterior =
    colas.get(key) ||
    Promise.resolve();

  const siguiente =
    anterior
      .catch(() => null)
      .then(() =>
        registrarMovimientoDesdeEvento(
          event
        )
      )
      .catch((error) => {
        console.error(
          "[GRUK CAJA] fallo aislado procesando evento",
          {
            eventName:
              event?.eventName,
            empresaId:
              String(
                event?.payload?.empresaId ||
                ""
              ),
            origen:
              key,
            error:
              error instanceof Error
                ? error.message
                : String(error)
          }
        );
      })
      .finally(() => {
        if (
          colas.get(key) ===
          siguiente
        ) {
          colas.delete(key);
        }
      });

  colas.set(
    key,
    siguiente
  );
}

function registrarCajaListener() {
  if (registrado) return;

  for (
    const eventName of
    TIPOS_SOPORTADOS
  ) {
    eventBus.on(
      eventName,
      (event) => {
        if (
          !event?.payload?.empresaId
        ) {
          console.error(
            "[GRUK CAJA] evento sin empresaId",
            { eventName }
          );
          return;
        }

        encolar(event);
      }
    );
  }

  registrado = true;
}

module.exports = {
  registrarCajaListener
};
