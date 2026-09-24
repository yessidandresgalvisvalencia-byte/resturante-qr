"use strict";

const mongoose = require("mongoose");
const Decision = require("../models/CerebroDecision");
const Auditoria = require("../models/CerebroAuditoria");
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

async function obtenerUltimaDecision(auth) {
  return Decision.findOne(filtroTenant(auth))
    .sort({ createdAt: -1 })
    .lean();
}

async function procesarOrden({ auth, decisionId, ordenId, accion }) {
  if (!mongoose.Types.ObjectId.isValid(decisionId) ||
      !mongoose.Types.ObjectId.isValid(ordenId)) {
    throw serviceError(400, "Identificador invalido");
  }
  if (!mongoose.Types.ObjectId.isValid(auth.usuarioId)) {
    throw serviceError(401, "Identidad de usuario invalida");
  }
  if (!["APROBAR", "RECHAZAR"].includes(accion)) {
    throw serviceError(400, "Accion invalida");
  }

  const session = await mongoose.startSession();
  try {
    let ordenRespuesta = null;
    await session.withTransaction(async () => {
      const decision = await Decision.findOne(
        filtroTenant(auth, { _id: decisionId })
      ).session(session);

      if (!decision) throw serviceError(404, "Decision no encontrada");

      const orden = decision.ordenes_por_departamento.id(ordenId);
      if (!orden) throw serviceError(404, "Orden no encontrada");
      if (orden.estado !== "PENDIENTE_APROBACION") {
        throw serviceError(409, "La orden ya fue procesada");
      }

      if (accion === "APROBAR") {
        orden.estado = "APROBADA";
        orden.aprobadaPor = auth.usuarioId;
        orden.aprobadaAt = new Date();
      } else {
        orden.estado = "RECHAZADA";
      }

      await decision.save({ session });
      await Auditoria.create([{
        empresaId: auth.empresaId,
        sedeId: auth.sedeId || null,
        decisionId: decision._id,
        ordenId: orden._id,
        accion,
        usuarioId: auth.usuarioId,
        metadata: { rol: auth.rol }
      }], { session });

      ordenRespuesta = orden.toObject();
    });
    return ordenRespuesta;
  } finally {
    await session.endSession();
  }
}

module.exports = { obtenerUltimaDecision, procesarOrden, filtroTenant };
