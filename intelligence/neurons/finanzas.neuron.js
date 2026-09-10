"use strict";

const mongoose = require("mongoose");

const Empresa = require("../../models/Empresa");
const CerebroReporteNeurona = require(
  "../models/CerebroReporteNeurona"
);

const {
  obtenerResumenVentas,
  obtenerResumenGastos
} = require("../../core/finanzas/finanzas.service");

const NEURONA = "FINANZAS";

function getRequiredEvents() {
  return ["VENTA_COMPLETADA", "GASTO_REGISTRADO"];
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

function calcularEstadoMargen({
  margenActual,
  margenObjetivo
}) {
  if (
    margenActual === null ||
    margenObjetivo === null
  ) {
    return "ALERTA";
  }

  if (margenActual >= margenObjetivo) {
    return "OK";
  }

  const desviacion =
    margenObjetivo - margenActual;

  if (desviacion >= 10) {
    return "CRITICO";
  }

  return "ALERTA";
}

function calcularConfianza(coberturaCostoPorcentaje) {
  const cobertura =
    Number(coberturaCostoPorcentaje);

  if (!Number.isFinite(cobertura)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(cobertura))
  );
}

async function analyze(empresaId) {
  if (
    !empresaId ||
    !mongoose.Types.ObjectId.isValid(empresaId)
  ) {
    throw new Error(
      "FINANZAS_NEURON_EMPRESA_ID_INVALIDO"
    );
  }

  const empresa = await Empresa.findById(empresaId)
    .select(
      "_id configuracion.margen_objetivo"
    )
    .lean();

  if (!empresa) {
    throw new Error(
      "FINANZAS_NEURON_EMPRESA_NO_ENCONTRADA"
    );
  }

  const { desde, hasta } =
    obtenerPeriodoActual();

  const [resumen, resumenGastos] = await Promise.all([
    obtenerResumenVentas({
      empresaId: empresa._id,
      desde,
      hasta
    }),
    obtenerResumenGastos({
      empresaId: empresa._id,
      desde,
      hasta
    })
  ]);

  const margenActual =
    resumen.margenBrutoConfiable === null
      ? null
      : Number(resumen.margenBrutoConfiable);

  const margenConfigurado =
    empresa.configuracion?.margen_objetivo;

  const margenObjetivo =
    margenConfigurado === null ||
    margenConfigurado === undefined
      ? null
      : Number(margenConfigurado);

  const coberturaCosto =
    Number(resumen.coberturaCostoPorcentaje);

  const confianza =
    calcularConfianza(coberturaCosto);

  const hallazgos = [];

  if (resumenGastos.gastosRegistrados > 0) {
    hallazgos.push({
      tipo: "GASTOS_REGISTRADOS_PERIODO",
      evidencia:
        `${resumenGastos.gastosRegistrados} gasto(s) ` +
        `registrado(s) por un total de ` +
        `${resumenGastos.montoGastosRegistrados}.`,
      impacto_financiero_estimado:
        resumenGastos.montoGastosRegistrados,
      confianza: 100
    });
  }

  if (margenObjetivo === null) {
    hallazgos.push({
      tipo: "CONFIGURACION_INCOMPLETA",
      evidencia:
        "La empresa no tiene margen objetivo configurado.",
      impacto_financiero_estimado: 0,
      confianza: 100
    });
  }

  if (resumen.ventasSinCostoConfiable > 0) {
    hallazgos.push({
      tipo: "COSTO_NO_CONFIABLE",
      evidencia:
        `${resumen.ventasSinCostoConfiable} venta(s) ` +
        "no tienen costo congelado confiable.",
      impacto_financiero_estimado: 0,
      confianza: 100
    });
  }

  if (
    margenActual !== null &&
    margenObjetivo !== null &&
    margenActual < margenObjetivo
  ) {
    const diferenciaPuntos =
      margenObjetivo - margenActual;

    const impactoEstimado =
      resumen.ingresosConCostoConfiable *
      (diferenciaPuntos / 100);

    hallazgos.push({
      tipo: "MARGEN_BAJO_OBJETIVO",
      evidencia:
        `Margen bruto confiable ${margenActual.toFixed(2)}%, ` +
        `objetivo ${margenObjetivo.toFixed(2)}%.`,
      impacto_financiero_estimado:
        Math.max(0, impactoEstimado),
      confianza
    });
  }

  if (resumen.ventasTotales === 0) {
    hallazgos.push({
      tipo: "SIN_VENTAS_EN_PERIODO",
      evidencia:
        "No existen ventas pagadas en el periodo analizado.",
      impacto_financiero_estimado: 0,
      confianza: 100
    });
  }

  const estado = calcularEstadoMargen({
    margenActual,
    margenObjetivo
  });

  const necesitaDecision =
    estado !== "OK" ||
    hallazgos.some(
      (hallazgo) =>
        hallazgo.tipo ===
          "CONFIGURACION_INCOMPLETA" ||
        hallazgo.tipo ===
          "COSTO_NO_CONFIABLE"
    );

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
      nombre: "margen_bruto_confiable",
      valor_actual: margenActual,
      valor_objetivo: margenObjetivo,
      estado
    },

    hallazgos,

    necesita_decision_de_cerebro:
      necesitaDecision,

    createdBy: null,

    deletedAt: null
  });

  return reporte.toObject();
}

module.exports = {
  getRequiredEvents,
  analyze
};