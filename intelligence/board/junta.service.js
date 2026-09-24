"use strict";

const mongoose = require("mongoose");
const Joi = require("joi");
const JuntaSesion = require("./JuntaSesion");
const Decision = require("../models/CerebroDecision");
const Reporte = require("../models/CerebroReporteNeurona");
const { ROLES_GRUK } = require("../../core/auth/roleCheck.middleware");

const DEPARTAMENTO_POR_NEURONA = Object.freeze({
  FINANZAS: "FINANZAS",
  VENTAS: "VENTAS",
  MARKETING: "MARKETING",
  OPERACIONES: "OPERACIONES",
  GENTE: "GENTE"
});

const intervencionHumanaSchema = Joi.object({
  departamento: Joi.string()
    .valid("DIRECCION", "OPERACIONES", "VENTAS", "FINANZAS", "MARKETING", "GENTE", "SERVICIO_CLIENTE")
    .required(),
  mensaje: Joi.string().trim().min(3).max(2000).required()
}).required();

function serviceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function filtroTenant(auth, extra = {}) {
  const filtro = {
    empresaId: auth.empresaId,
    deletedAt: null,
    ...extra
  };

  if (auth.rol === ROLES_GRUK.ADMIN_SEDE) {
    if (!auth.sedeId) {
      throw serviceError(403, "ADMIN_SEDE requiere una sede autorizada");
    }
    filtro.sedeId = auth.sedeId;
  }

  return filtro;
}

function formatearNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function construirIntervencionNeurona(reporte) {
  const hallazgos = Array.isArray(reporte.hallazgos) ? reporte.hallazgos : [];
  const impactos = hallazgos.map((h) => Number(h.impacto_financiero_estimado) || 0);
  const confianzas = hallazgos.map((h) => Number(h.confianza)).filter(Number.isFinite);

  const impacto = impactos.reduce((suma, valor) => suma + Math.max(0, valor), 0);
  const confianza = confianzas.length
    ? Math.round(confianzas.reduce((suma, valor) => suma + valor, 0) / confianzas.length)
    : 100;

  const actual = formatearNumero(reporte.kpi_principal?.valor_actual);
  const objetivo = formatearNumero(reporte.kpi_principal?.valor_objetivo);
  const estado = String(reporte.kpi_principal?.estado || "ALERTA");
  const nombreKpi = String(reporte.kpi_principal?.nombre || "kpi");

  const mensaje =
    `${reporte.neurona}: ${nombreKpi} está en ${estado}. ` +
    `Valor actual: ${actual === null ? "sin dato" : actual}. ` +
    `Objetivo: ${objetivo === null ? "sin dato" : objetivo}.`;

  const evidencia = hallazgos.length
    ? hallazgos.map((hallazgo) => hallazgo.evidencia).filter(Boolean).join(" | ")
    : "Sin hallazgos adicionales para el periodo.";

  return {
    tipo: "NEURONA",
    departamento: DEPARTAMENTO_POR_NEURONA[reporte.neurona] || "DIRECCION",
    autorUsuarioId: null,
    mensaje,
    evidencia,
    impacto_financiero_estimado: impacto,
    confianza
  };
}

async function abrirSesion({ auth, decisionId }) {
  if (!mongoose.Types.ObjectId.isValid(decisionId)) {
    throw serviceError(400, "Decision invalida");
  }

  if (!mongoose.Types.ObjectId.isValid(auth.usuarioId)) {
    throw serviceError(401, "Identidad de usuario invalida");
  }

  const decision = await Decision.findOne(
    filtroTenant(auth, { _id: decisionId })
  ).lean();

  if (!decision) {
    throw serviceError(404, "Decision no encontrada");
  }

  let sesion = await JuntaSesion.findOne(
    filtroTenant(auth, { decisionId: decision._id })
  ).lean();

  if (sesion) return sesion;

  const reportes = await Reporte.find({
    empresaId: auth.empresaId,
    _id: { $in: decision.reportesOrigen || [] },
    deletedAt: null
  }).lean();

  if (reportes.length !== 5) {
    throw serviceError(409, "La Junta requiere los cinco reportes origen");
  }

  const intervenciones = reportes.map(construirIntervencionNeurona);

  try {
    const creada = await JuntaSesion.create({
      empresaId: auth.empresaId,
      sedeId: auth.sedeId || null,
      decisionId: decision._id,
      estado: "ABIERTA",
      intervenciones,
      createdBy: auth.usuarioId,
      deletedAt: null
    });

    return creada.toObject();
  } catch (error) {
    if (error?.code === 11000) {
      sesion = await JuntaSesion.findOne(
        filtroTenant(auth, { decisionId: decision._id })
      ).lean();
      if (sesion) return sesion;
    }
    throw error;
  }
}

async function cerrarSesion({ auth, sesionId }) {
  if (!mongoose.Types.ObjectId.isValid(sesionId)) {
    throw serviceError(400, "Sesion invalida");
  }

  if (!mongoose.Types.ObjectId.isValid(auth.usuarioId)) {
    throw serviceError(401, "Identidad de usuario invalida");
  }

  const sesion = await JuntaSesion.findOne(
    filtroTenant(auth, { _id: sesionId })
  );

  if (!sesion) {
    throw serviceError(404, "Sesion no encontrada");
  }

  if (sesion.estado === "CERRADA") {
    return sesion.toObject();
  }

  sesion.estado = "CERRADA";
  sesion.closedBy = auth.usuarioId;
  sesion.closedAt = new Date();

  await sesion.save();
  return sesion.toObject();
}

async function agregarIntervencion({ auth, sesionId, payload }) {
  if (!mongoose.Types.ObjectId.isValid(sesionId)) {
    throw serviceError(400, "Sesion invalida");
  }

  if (!mongoose.Types.ObjectId.isValid(auth.usuarioId)) {
    throw serviceError(401, "Identidad de usuario invalida");
  }

  const { error, value } = intervencionHumanaSchema.validate(payload, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw serviceError(400, "Intervencion invalida");
  }

  const sesion = await JuntaSesion.findOne(
    filtroTenant(auth, { _id: sesionId })
  );

  if (!sesion) {
    throw serviceError(404, "Sesion no encontrada");
  }

  if (sesion.estado !== "ABIERTA") {
    throw serviceError(409, "La sesion de Junta ya esta cerrada");
  }

  sesion.intervenciones.push({
    tipo: "HUMANO",
    departamento: value.departamento,
    autorUsuarioId: auth.usuarioId,
    mensaje: value.mensaje,
    evidencia: "",
    impacto_financiero_estimado: 0,
    confianza: 100
  });

  await sesion.save();
  return sesion.toObject();
}

module.exports = {
  abrirSesion,
  agregarIntervencion,
  cerrarSesion,
  construirIntervencionNeurona
};
