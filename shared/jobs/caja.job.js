"use strict";

const cron = require("node-cron");

const Empresa = require("../../models/Empresa");
const eventBus = require("../../core/eventos/eventBus");
const {
  reconciliarPeriodoCaja
} = require("../../core/finanzas/caja.service");

let iniciado = false;
let enCurso = false;

function periodoMesActualUTC() {
  const ahora = new Date();

  return {
    desde: new Date(
      Date.UTC(
        ahora.getUTCFullYear(),
        ahora.getUTCMonth(),
        1,
        0,
        0,
        0,
        0
      )
    ),
    hasta: new Date(
      Date.UTC(
        ahora.getUTCFullYear(),
        ahora.getUTCMonth() + 1,
        1,
        0,
        0,
        0,
        0
      )
    )
  };
}

async function reconciliarCajaActiva() {
  if (enCurso) return;

  enCurso = true;

  try {
    const empresas =
      await Empresa.find({
        estado: "activa"
      })
        .select("_id")
        .lean();

    const {
      desde,
      hasta
    } = periodoMesActualUTC();

    for (const empresa of empresas) {
      try {
        const resultado =
          await reconciliarPeriodoCaja({
            empresaId:
              empresa._id,
            desde,
            hasta
          });

        eventBus.emit(
          "CAJA_RECONCILIADA",
          {
            empresaId:
              empresa._id,
            sedeId: null,
            desde,
            hasta,
            revisados:
              resultado.revisados,
            creados:
              resultado.creados
          }
        );

        console.log(
          "[GRUK CAJA] reconciliacion completada",
          {
            empresaId:
              String(empresa._id),
            revisados:
              resultado.revisados,
            creados:
              resultado.creados
          }
        );
      } catch (error) {
        console.error(
          "[GRUK CAJA] reconciliacion empresa fallo",
          {
            empresaId:
              String(empresa._id),
            error:
              error instanceof Error
                ? error.message
                : String(error)
          }
        );
      }
    }
  } catch (error) {
    console.error(
      "[GRUK CAJA] job de reconciliacion fallo",
      error
    );
  } finally {
    enCurso = false;
  }
}

function iniciarCajaJob() {
  if (iniciado) return;

  iniciado = true;

  // Reconciliacion defensiva horaria.
  cron.schedule(
    "17 * * * *",
    () => {
      void reconciliarCajaActiva();
    }
  );

  // Al desplegar, reconstruye el mes actual
  // sin esperar al siguiente ciclo horario.
  setImmediate(() => {
    void reconciliarCajaActiva();
  });
}

module.exports =
  iniciarCajaJob;

module.exports.reconciliarCajaActiva =
  reconciliarCajaActiva;

module.exports.periodoMesActualUTC =
  periodoMesActualUTC;
