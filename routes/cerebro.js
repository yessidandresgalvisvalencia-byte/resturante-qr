"use strict";

const express = require("express");
const auth = require("../core/auth/auth.middleware");
const { ROLES_GRUK, roleCheck } = require("../core/auth/roleCheck.middleware");
const {
  obtenerUltimaDecision,
  procesarOrden
} = require("../intelligence/brain/cerebro.service");

const router = express.Router();
const seguridad = [
  auth,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE)
];

function responderError(res, error, operacion) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ ok: false, error: error.message });
  }
  console.error(`Cerebro ${operacion}:`, error);
  return res.status(500).json({ ok: false, error: "Error procesando solicitud del Cerebro" });
}

router.get("/ultima-decision", ...seguridad, async (req, res) => {
  try {
    const decision = await obtenerUltimaDecision(req.auth);
    return res.json({ ok: true, decision: decision || null });
  } catch (error) {
    return responderError(res, error, "ultima decision");
  }
});

router.post("/decisiones/:decisionId/ordenes/:ordenId/aprobar", ...seguridad, async (req, res) => {
  try {
    const orden = await procesarOrden({
      auth: req.auth,
      decisionId: req.params.decisionId,
      ordenId: req.params.ordenId,
      accion: "APROBAR"
    });
    return res.json({ ok: true, orden });
  } catch (error) {
    return responderError(res, error, "aprobar orden");
  }
});

router.post("/decisiones/:decisionId/ordenes/:ordenId/rechazar", ...seguridad, async (req, res) => {
  try {
    const orden = await procesarOrden({
      auth: req.auth,
      decisionId: req.params.decisionId,
      ordenId: req.params.ordenId,
      accion: "RECHAZAR"
    });
    return res.json({ ok: true, orden });
  } catch (error) {
    return responderError(res, error, "rechazar orden");
  }
});

module.exports = router;
