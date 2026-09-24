"use strict";

const finanzas = require("../neurons/finanzas.neuron");
const ventas = require("../neurons/ventas.neuron");
const marketing = require("../neurons/marketing.neuron");
const operaciones = require("../neurons/operaciones.neuron");
const gente = require("../neurons/gente.neuron");
const cerebro = require("../brain/cerebro");
const { evaluarModulosAutomaticos } = require("../../core/modulos/modulos.service");

const NEURONAS = Object.freeze([
  finanzas,
  ventas,
  marketing,
  operaciones,
  gente
]);

async function ejecutarCicloEmpresa(empresaId) {
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

  const requiereDecision = reportes.some(
    (reporte) =>
      reporte.necesita_decision_de_cerebro === true ||
      reporte.kpi_principal?.estado === "CRITICO"
  );

  const decision = requiereDecision
    ? await cerebro.tomarDecision(empresaId)
    : null;

  return { modulos, reportes, decision };
}

module.exports = {
  ejecutarCicloEmpresa,
  NEURONAS
};
