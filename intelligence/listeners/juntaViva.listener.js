"use strict";

const eventBus = require("../../core/eventos/eventBus");
const {
  recalcularEstadoVivo
} = require("../board/juntaViva.service");

const EVENTOS = Object.freeze([
  "VENTA_COMPLETADA",
  "GASTO_REGISTRADO",
  "GASTO_PAGO_ACTUALIZADO",
  "COMPRA_REGISTRADA",
  "COMPRA_PAGO_ACTUALIZADO",
  "CAJA_MOVIMIENTO_REGISTRADO",
  "CAJA_RECONCILIADA",
  "TESORERIA_CUENTA_CREADA",
  "TESORERIA_TRANSFERENCIA_COMPLETADA",
  "OBLIGACION_RECURRENTE_CREADA",
  "OBLIGACION_RECURRENTE_DESACTIVADA",
  "POLITICA_FINANCIERA_ACTUALIZADA",
  "CICLO_INTELIGENCIA_COMPLETADO"
]);

let registrado = false;

const pendientes = new Map();
const procesando = new Set();

function claveScope(
  empresaId,
  sedeId
) {
  return [
    String(empresaId),
    sedeId ? String(sedeId) : "GLOBAL"
  ].join(":");
}

async function procesarScope({
  empresaId,
  sedeId
}) {
  const key =
    claveScope(
      empresaId,
      sedeId
    );

  if (procesando.has(key)) return;

  procesando.add(key);

  try {
    while (pendientes.has(key)) {
      const event =
        pendientes.get(key);

      pendientes.delete(key);

      await recalcularEstadoVivo({
        empresaId,
        sedeId,
        event
      });
    }
  } finally {
    procesando.delete(key);

    if (pendientes.has(key)) {
      setImmediate(() => {
        void procesarScope({
          empresaId,
          sedeId
        });
      });
    }
  }
}

function encolar({
  empresaId,
  sedeId,
  event
}) {
  const key =
    claveScope(
      empresaId,
      sedeId
    );

  pendientes.set(key, event);

  setImmediate(() => {
    void procesarScope({
      empresaId,
      sedeId
    }).catch((error) => {
      console.error(
        "[GRUK JUNTA VIVA] fallo al actualizar estado",
        {
          empresaId:
            String(empresaId),
          sedeId:
            sedeId
              ? String(sedeId)
              : null,
          eventName:
            event?.eventName,
          error:
            error instanceof Error
              ? error.message
              : String(error)
        }
      );
    });
  });
}

function registrarJuntaVivaListener() {
  if (registrado) return;

  for (
    const eventName of EVENTOS
  ) {
    eventBus.on(
      eventName,
      (event) => {
        const empresaId =
          event?.payload?.empresaId;

        if (!empresaId) {
          console.error(
            "[GRUK JUNTA VIVA] evento sin empresaId",
            { eventName }
          );
          return;
        }

        // Vista global para DUEÑO.
        encolar({
          empresaId,
          sedeId: null,
          event
        });

        // Vista aislada para ADMIN_SEDE.
        if (event?.payload?.sedeId) {
          encolar({
            empresaId,
            sedeId:
              event.payload.sedeId,
            event
          });
        }
      }
    );
  }

  registrado = true;
}

module.exports = {
  EVENTOS,
  registrarJuntaVivaListener
};
