"use strict";

const mongoose = require("mongoose");
const Inventario = require("../../models/Inventario");
const CerebroReporteNeurona = require("../models/CerebroReporteNeurona");

const NEURONA = "OPERACIONES";

function getRequiredEvents() {
  return [];
}

function periodoActualUTC() {
  const ahora = new Date();
  return {
    desde: new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)),
    hasta: new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1))
  };
}

async function analyze(empresaId) {
  if (!mongoose.Types.ObjectId.isValid(empresaId)) {
    throw new Error("OPERACIONES_NEURON_EMPRESA_ID_INVALIDO");
  }

  const empresaObjectId = new mongoose.Types.ObjectId(String(empresaId));
  const { desde, hasta } = periodoActualUTC();

  const [total, agotados] = await Promise.all([
    Inventario.countDocuments({ empresaId: empresaObjectId, anulado: false }),
    Inventario.countDocuments({
      empresaId: empresaObjectId,
      anulado: false,
      $or: [{ estado: "agotado" }, { cantidad: { $lte: 0 } }]
    })
  ]);

  const porcentaje = total ? (agotados / total) * 100 : 0;
  const estado = total === 0
    ? "ALERTA"
    : agotados === 0
      ? "OK"
      : porcentaje >= 20
        ? "CRITICO"
        : "ALERTA";

  const hallazgos = [];

  if (!total) {
    hallazgos.push({
      tipo: "SIN_INVENTARIO_CONFIGURADO",
      evidencia: "No existen items de inventario activos para medir disponibilidad.",
      impacto_financiero_estimado: 0,
      confianza: 100
    });
  }

  if (agotados) {
    hallazgos.push({
      tipo: "INVENTARIO_AGOTADO",
      evidencia: `${agotados} de ${total} item(s) de inventario estan agotados.`,
      impacto_financiero_estimado: 0,
      confianza: 100
    });
  }

  const doc = await CerebroReporteNeurona.create({
    neurona: NEURONA,
    empresaId: empresaObjectId,
    sedeId: null,
    periodo: { desde, hasta },
    timestamp: new Date(),
    kpi_principal: {
      nombre: "porcentaje_items_agotados",
      valor_actual:
        total === 0
          ? null
          : Number(porcentaje.toFixed(2)),
      valor_objetivo: 0,
      estado,
      medicion_disponible:
        total > 0,
      objetivo_disponible: true,
      motivo_no_evaluable:
        total === 0
          ? "No existen items activos de inventario para medir disponibilidad."
          : "",
      evaluabilidad:
        total === 0
          ? "DATOS_INSUFICIENTES"
          : "EVALUABLE"
    },
    hallazgos,
    necesita_decision_de_cerebro:
      total > 0 &&
      estado !== "OK",
    createdBy: null,
    deletedAt: null
  });

  return doc.toObject();
}

module.exports = { getRequiredEvents, analyze };
