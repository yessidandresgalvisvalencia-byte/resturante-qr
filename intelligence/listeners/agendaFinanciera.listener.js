"use strict";

const eventBus = require("../../core/eventos/eventBus");
const {
  ejecutarCicloEmpresa
} = require("../orchestrator/cicloInteligencia");

const EVENTOS_AGENDA = Object.freeze([
  "COMPRA_REGISTRADA",
  "COMPRA_PAGO_ACTUALIZADO",
  "TESORERIA_CUENTA_CREADA",
  "OBLIGACION_RECURRENTE_CREADA",
  "OBLIGACION_RECURRENTE_DESACTIVADA",
  "POLITICA_FINANCIERA_ACTUALIZADA",
  "EXCEPCION_PRIORIDAD_PAGO_CREADA",
  "EXCEPCION_PRIORIDAD_PAGO_REVOCADA"
]);

let registrado = false;

const timers = new Map();
const procesando = new Set();
const pendientes = new Set();

function programar(empresaId) {
  const key = String(empresaId);

  if (timers.has(key)) {
    clearTimeout(
      timers.get(key)
    );
  }

  const timer = setTimeout(
    () => {
      timers.delete(key);
      void ejecutar(key);
    },
    250
  );

  timers.set(key, timer);
}

async function ejecutar(empresaId) {
  const key = String(empresaId);

  if (procesando.has(key)) {
    pendientes.add(key);
    return;
  }

  procesando.add(key);

  try {
    const resultado =
      await ejecutarCicloEmpresa(
        empresaId
      );

    console.log(
      "[GRUK AGENDA] ciclo financiero inmediato",
      {
        empresaId: key,
        estado7d:
          resultado
            ?.agendaFinanciera
            ?.estado7d || null,
        requiereDecision:
          Boolean(
            resultado
              ?.agendaFinanciera
              ?.requiereDecision
          ),
        decisionId:
          resultado?.decision?._id
            ? String(
                resultado.decision._id
              )
            : null
      }
    );
  } catch (error) {
    console.error(
      "[GRUK AGENDA] ciclo financiero fallo aislado",
      {
        empresaId: key,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      }
    );
  } finally {
    procesando.delete(key);

    if (pendientes.has(key)) {
      pendientes.delete(key);
      programar(key);
    }
  }
}

function registrarAgendaFinancieraListener() {
  if (registrado) return;

  for (
    const eventName of
    EVENTOS_AGENDA
  ) {
    eventBus.on(
      eventName,
      (event) => {
        const empresaId =
          event?.payload?.empresaId;

        if (!empresaId) {
          console.error(
            "[GRUK AGENDA] evento sin empresaId",
            { eventName }
          );
          return;
        }

        programar(
          empresaId
        );
      }
    );
  }

  registrado = true;
}

module.exports = {
  EVENTOS_AGENDA,
  registrarAgendaFinancieraListener
};
