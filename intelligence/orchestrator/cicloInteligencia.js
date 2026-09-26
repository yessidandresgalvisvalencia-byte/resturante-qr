"use strict";

const finanzas = require("../neurons/finanzas.neuron");
const ventas = require("../neurons/ventas.neuron");
const marketing = require("../neurons/marketing.neuron");
const operaciones = require("../neurons/operaciones.neuron");
const gente = require("../neurons/gente.neuron");
const cerebro = require("../brain/cerebro");
const {
  construirProyeccionTesoreria
} = require("../../core/finanzas/tesoreriaProyeccion.service");
const {
  construirAgendaFinanciera
} = require("../brain/agendaFinanciera.service");
const { evaluarModulosAutomaticos } = require("../../core/modulos/modulos.service");
const eventBus = require("../../core/eventos/eventBus");

const NEURONAS = Object.freeze([
  finanzas,
  ventas,
  marketing,
  operaciones,
  gente
]);

function debeTomarDecision(
  reportes,
  forzarDecision = false,
  agendaFinanciera = null
) {
  if (forzarDecision) return true;
  if (agendaFinanciera?.requiereDecision) {
    return true;
  }
  return reportes.some(
    (reporte) =>
      !["SIN_CONFIGURAR", "DATOS_INSUFICIENTES"].includes(
        reporte.kpi_principal?.evaluabilidad ||
        reporte.kpi_principal?.estado
      ) &&
      reporte.kpi_principal?.estado === "CRITICO"
  );
}

async function ejecutarCicloEmpresa(empresaId, opciones = {}) {
  const { forzarDecision = false } = opciones;
  const modulos = await evaluarModulosAutomaticos(empresaId);
  const reportes = [];

  for (const neurona of NEURONAS) {
    const reporte = await neurona.analyze(empresaId);
    if (!reporte) {
      throw new Error("NEURONA_NO_GENERO_REPORTE");
    }
    reportes.push(reporte);
  }

  const nombres = new Set(reportes.map((reporte) => reporte.neurona));
  if (nombres.size !== NEURONAS.length) {
    throw new Error("CICLO_INTELIGENCIA_REPORTES_INCOMPLETOS");
  }

  const proyeccionTesoreria =
    await construirProyeccionTesoreria({
      empresaId
    });

  const agendaFinanciera =
    construirAgendaFinanciera(
      proyeccionTesoreria
    );

  const requiereCierreFinanciero =
    await cerebro
      .requiereActualizarDecisionFinanciera(
        empresaId,
        agendaFinanciera
      );

  const decision =
    (
      debeTomarDecision(
        reportes,
        forzarDecision,
        agendaFinanciera
      ) ||
      requiereCierreFinanciero
    )
      ? await cerebro.tomarDecision(
          empresaId,
          {
            agendaFinanciera
          }
        )
      : null;

  eventBus.emit("CICLO_INTELIGENCIA_COMPLETADO", {
    empresaId,
    reportesIds: reportes.map((reporte) => reporte._id),
    decisionId: decision?._id || null,
    hayCriticos: reportes.some(
      (reporte) =>
        reporte.kpi_principal?.evaluabilidad === "EVALUABLE" &&
        reporte.kpi_principal?.estado === "CRITICO"
    )
  });

  return {
    modulos,
    reportes,
    proyeccionTesoreria,
    agendaFinanciera,
    decision
  };
}

module.exports = {
  ejecutarCicloEmpresa,
  debeTomarDecision,
  NEURONAS
};
