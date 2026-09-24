"use strict";

const mongoose = require("mongoose");
const CerebroMemoria = require("./CerebroMemoria");
const { medirKpi } = require("./kpi.service");
const { ROLES_GRUK } = require("../../core/auth/roleCheck.middleware");

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

function compararResultado({ baseline, seguimiento, direccion }) {
  if (
    !baseline?.medible ||
    !seguimiento?.medible ||
    baseline.valor === null ||
    seguimiento.valor === null
  ) {
    return "NO_MEDIBLE";
  }

  const antes = Number(baseline.valor);
  const despues = Number(seguimiento.valor);

  if (!Number.isFinite(antes) || !Number.isFinite(despues)) {
    return "NO_MEDIBLE";
  }

  const diferencia = despues - antes;
  if (Math.abs(diferencia) < 1e-9) {
    return "SIN_CAMBIO";
  }

  if (direccion === "MENOR_ES_MEJOR") {
    return diferencia < 0 ? "MEJORO" : "EMPEORO";
  }

  return diferencia > 0 ? "MEJORO" : "EMPEORO";
}

function evaluarObjetivo({ seguimiento, direccion }) {
  if (
    !seguimiento?.medible ||
    seguimiento.valor === null ||
    seguimiento.objetivo === null
  ) {
    return null;
  }

  const valor = Number(seguimiento.valor);
  const objetivo = Number(seguimiento.objetivo);

  if (!Number.isFinite(valor) || !Number.isFinite(objetivo)) {
    return null;
  }

  return direccion === "MENOR_ES_MEJOR"
    ? valor <= objetivo
    : valor >= objetivo;
}

async function registrarBaselineAprobacion({
  auth,
  decision,
  orden,
  session
}) {
  if (!mongoose.Types.ObjectId.isValid(auth.usuarioId)) {
    throw serviceError(401, "Identidad de usuario invalida");
  }

  const baseline = await medirKpi({
    empresaId: auth.empresaId,
    kpi: orden.kpi_a_medir,
    session
  });

  const evaluarAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [memoria] = await CerebroMemoria.create([{
    empresaId: auth.empresaId,
    sedeId: auth.sedeId || null,
    decisionId: decision._id,
    ordenId: orden._id,
    departamento: orden.departamento,
    kpi: orden.kpi_a_medir,
    direccion: baseline.direccion,
    baseline: {
      valor: baseline.valor,
      objetivo: baseline.objetivo,
      medible: baseline.medible,
      measuredAt: baseline.measuredAt
    },
    seguimiento: null,
    evaluarAt,
    resultado: "PENDIENTE",
    cumplioObjetivo: null,
    createdBy: auth.usuarioId,
    deletedAt: null
  }], { session });

  return memoria.toObject();
}

async function evaluarMemoria(memoria) {
  const seguimiento = await medirKpi({
    empresaId: memoria.empresaId,
    kpi: memoria.kpi
  });

  const resultado = compararResultado({
    baseline: memoria.baseline,
    seguimiento,
    direccion: memoria.direccion
  });

  const cumplioObjetivo = evaluarObjetivo({
    seguimiento,
    direccion: memoria.direccion
  });

  await CerebroMemoria.updateOne(
    {
      _id: memoria._id,
      resultado: "PENDIENTE",
      deletedAt: null
    },
    {
      $set: {
        seguimiento: {
          valor: seguimiento.valor,
          objetivo: seguimiento.objetivo,
          medible: seguimiento.medible,
          measuredAt: seguimiento.measuredAt
        },
        resultado,
        cumplioObjetivo
      }
    }
  );

  return {
    memoriaId: memoria._id,
    resultado,
    cumplioObjetivo
  };
}

async function evaluarPendientes(ahora = new Date()) {
  const pendientes = await CerebroMemoria.find({
    resultado: "PENDIENTE",
    evaluarAt: { $lte: ahora },
    deletedAt: null
  }).lean();

  const resultados = [];

  for (const memoria of pendientes) {
    try {
      resultados.push(await evaluarMemoria(memoria));
    } catch (error) {
      console.error("[GRUK MEMORIA] evaluacion fallo", {
        memoriaId: String(memoria._id),
        empresaId: String(memoria.empresaId),
        error: error.message
      });
    }
  }

  return resultados;
}

async function obtenerMemorias(auth, limite = 100) {
  const maximo = Math.max(1, Math.min(200, Number(limite) || 100));

  return CerebroMemoria.find(filtroTenant(auth))
    .sort({ createdAt: -1 })
    .limit(maximo)
    .lean();
}

module.exports = {
  registrarBaselineAprobacion,
  evaluarPendientes,
  obtenerMemorias,
  compararResultado,
  evaluarObjetivo,
  filtroTenant
};
