"use strict";

const mongoose = require("mongoose");

const Empresa = require("../../models/Empresa");
const CerebroReporteNeurona = require(
  "../models/CerebroReporteNeurona"
);

const NEURONA = "MARKETING";

function getRequiredEvents() {
  /*
   * No existe todavia un evento con atribucion
   * suficiente para calcular adquisicion de clientes.
   *
   * VENTA_COMPLETADA no identifica cliente nuevo.
   * GASTO_REGISTRADO no identifica gasto de marketing
   * de forma canonica.
   */
  return [];
}

function obtenerPeriodoActual() {
  const ahora = new Date();

  const desde = new Date(
    Date.UTC(
      ahora.getUTCFullYear(),
      ahora.getUTCMonth(),
      1,
      0,
      0,
      0,
      0
    )
  );

  const hasta = new Date(
    Date.UTC(
      ahora.getUTCFullYear(),
      ahora.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0
    )
  );

  return {
    desde,
    hasta
  };
}

async function analyze(empresaId) {
  if (
    !empresaId ||
    !mongoose.Types.ObjectId.isValid(empresaId)
  ) {
    throw new Error(
      "MARKETING_NEURON_EMPRESA_ID_INVALIDO"
    );
  }

  const empresa = await Empresa.findById(empresaId)
    .select(
      "_id configuracion.cac_maximo"
    )
    .lean();

  if (!empresa) {
    throw new Error(
      "MARKETING_NEURON_EMPRESA_NO_ENCONTRADA"
    );
  }

  const { desde, hasta } =
    obtenerPeriodoActual();

  const cacConfigurado =
    empresa.configuracion?.cac_maximo;

  const cacObjetivo =
    cacConfigurado === null ||
    cacConfigurado === undefined
      ? null
      : Number(cacConfigurado);

  /*
   * No existe todavia un denominador confiable de
   * clientes adquiridos atribuibles a Marketing.
   *
   * CAC = gasto de adquisicion / clientes adquiridos.
   * Sin ambos datos confiables, CAC debe ser null.
   */
  const cacActual = null;

  const hallazgos = [
    {
      tipo: "DATOS_INSUFICIENTES",
      evidencia:
        "No existen datos atribuibles suficientes " +
        "para calcular CAC sin inventar valores.",
      impacto_financiero_estimado: 0,
      confianza: 100
    }
  ];

  if (cacObjetivo === null) {
    hallazgos.push({
      tipo: "CONFIGURACION_INCOMPLETA",
      evidencia:
        "La empresa no tiene CAC maximo configurado.",
      impacto_financiero_estimado: 0,
      confianza: 100
    });
  }

  const reporte = await CerebroReporteNeurona.create({
    neurona: NEURONA,

    empresaId: empresa._id,

    sedeId: null,

    periodo: {
      desde,
      hasta
    },

    timestamp: new Date(),

    kpi_principal: {
      nombre: "cac",
      valor_actual: cacActual,
      valor_objetivo: cacObjetivo,
      estado: "ALERTA",
      medicion_disponible: false,
      objetivo_disponible:
        cacObjetivo !== null,
      motivo_no_evaluable:
        cacObjetivo === null
          ? "Falta configurar CAC maximo y todavia no existe atribucion suficiente para calcular CAC."
          : "Todavia no existe atribucion suficiente para calcular CAC sin inventar valores."
    },

    hallazgos,

    necesita_decision_de_cerebro: false,

    createdBy: null,

    deletedAt: null
  });

  return reporte.toObject();
}

module.exports = {
  getRequiredEvents,
  analyze
};
