"use strict";

const express = require("express");
const mongoose = require("mongoose");
const auth = require("../core/auth/auth.middleware");
const { ROLES_GRUK, roleCheck } = require("../core/auth/roleCheck.middleware");
const Decision = require("../intelligence/models/CerebroDecision");
const Auditoria = require("../intelligence/models/CerebroAuditoria");

const router = express.Router();
const seguridad = [
  auth,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE)
];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

router.get("/ultima-decision", ...seguridad, async (req, res) => {
  try {
    const filtro = {
      empresaId: req.auth.empresaId,
      deletedAt: null
    };

    if (req.auth.rol === ROLES_GRUK.ADMIN_SEDE) {
      if (!req.auth.sedeId) {
        return res.status(403).json({
          ok: false,
          error: "ADMIN_SEDE requiere una sede autorizada"
        });
      }
      filtro.sedeId = req.auth.sedeId;
    }

    const decision = await Decision.findOne(filtro)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ ok: true, decision: decision || null });
  } catch (error) {
    console.error("Cerebro ultima decision:", error);
    return res.status(500).json({
      ok: false,
      error: "Error consultando decision del Cerebro"
    });
  }
});

router.post(
  "/decisiones/:decisionId/ordenes/:ordenId/rechazar",
  ...seguridad,
  async (req, res) => {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.decisionId) ||
      !mongoose.Types.ObjectId.isValid(req.params.ordenId)
    ) {
      return res.status(400).json({ ok: false, error: "Identificador invalido" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.auth.usuarioId)) {
      return res.status(401).json({ ok: false, error: "Identidad de usuario invalida" });
    }

    const session = await mongoose.startSession();
    try {
      let ordenRespuesta = null;
      await session.withTransaction(async () => {
        const filtroDecision = {
          _id: req.params.decisionId,
          empresaId: req.auth.empresaId,
          deletedAt: null
        };

        if (req.auth.rol === ROLES_GRUK.ADMIN_SEDE) {
          if (!req.auth.sedeId) throw httpError(403, "ADMIN_SEDE requiere una sede autorizada");
          filtroDecision.sedeId = req.auth.sedeId;
        }

        const decision = await Decision.findOne(filtroDecision).session(session);
        if (!decision) throw httpError(404, "Decision no encontrada");

        const orden = decision.ordenes_por_departamento.id(req.params.ordenId);
        if (!orden) throw httpError(404, "Orden no encontrada");
        if (orden.estado !== "PENDIENTE_APROBACION") {
          throw httpError(409, "La orden ya fue procesada");
        }

        orden.estado = "RECHAZADA";
        await decision.save({ session });
        await Auditoria.create([{
          empresaId: req.auth.empresaId,
          sedeId: req.auth.sedeId || null,
          decisionId: decision._id,
          ordenId: orden._id,
          accion: "RECHAZAR",
          usuarioId: req.auth.usuarioId,
          metadata: { rol: req.auth.rol }
        }], { session });

        ordenRespuesta = orden.toObject();
      });

      return res.json({ ok: true, orden: ordenRespuesta });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ ok: false, error: error.message });
      }
      console.error("Cerebro rechazar orden:", error);
      return res.status(500).json({ ok: false, error: "Error rechazando orden" });
    } finally {
      await session.endSession();
    }
  }
);

router.post(
  "/decisiones/:decisionId/ordenes/:ordenId/aprobar",
  ...seguridad,
  async (req, res) => {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.decisionId) ||
      !mongoose.Types.ObjectId.isValid(req.params.ordenId)
    ) {
      return res.status(400).json({ ok: false, error: "Identificador invalido" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.auth.usuarioId)) {
      return res.status(401).json({ ok: false, error: "Identidad de usuario invalida" });
    }

    const session = await mongoose.startSession();

    try {
      let ordenRespuesta = null;

      await session.withTransaction(async () => {
        const filtroDecision = {
          _id: req.params.decisionId,
          empresaId: req.auth.empresaId,
          deletedAt: null
        };

        if (req.auth.rol === ROLES_GRUK.ADMIN_SEDE) {
          if (!req.auth.sedeId) {
            throw httpError(403, "ADMIN_SEDE requiere una sede autorizada");
          }
          filtroDecision.sedeId = req.auth.sedeId;
        }

        const decision = await Decision.findOne(filtroDecision).session(session);

        if (!decision) {
          throw httpError(404, "Decision no encontrada");
        }

        const orden = decision.ordenes_por_departamento.id(req.params.ordenId);
        if (!orden) {
          throw httpError(404, "Orden no encontrada");
        }

        if (orden.estado !== "PENDIENTE_APROBACION") {
          throw httpError(409, "La orden ya fue procesada");
        }

        orden.estado = "APROBADA";
        orden.aprobadaPor = req.auth.usuarioId;
        orden.aprobadaAt = new Date();

        await decision.save({ session });

        await Auditoria.create(
          [{
            empresaId: req.auth.empresaId,
            sedeId: req.auth.sedeId || null,
            decisionId: decision._id,
            ordenId: orden._id,
            accion: "APROBAR",
            usuarioId: req.auth.usuarioId,
            metadata: { rol: req.auth.rol }
          }],
          { session }
        );

        ordenRespuesta = orden.toObject();
      });

      return res.json({ ok: true, orden: ordenRespuesta });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          ok: false,
          error: error.message
        });
      }

      console.error("Cerebro aprobar orden:", error);
      return res.status(500).json({ ok: false, error: "Error aprobando orden" });
    } finally {
      await session.endSession();
    }
  }
);

module.exports = router;
