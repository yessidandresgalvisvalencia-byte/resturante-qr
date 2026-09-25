"use strict";

const express = require("express");
const auth = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");
const {
  ultimaDecision,
  auditoriaCerebro,
  planesPagoDecision,
  confirmarItemPlan,
  aprobarOrden,
  rechazarOrden
} = require("../intelligence/brain/cerebro.controller");

const router = express.Router();

const seguridad = [
  auth,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE)
];

router.get(
  "/ultima-decision",
  ...seguridad,
  ultimaDecision
);

router.get(
  "/auditoria",
  ...seguridad,
  auditoriaCerebro
);

router.get(
  "/decisiones/:decisionId/planes-pago",
  ...seguridad,
  planesPagoDecision
);

router.post(
  "/planes-pago/:planId/items/:itemId/confirmar",
  ...seguridad,
  confirmarItemPlan
);

router.post(
  "/decisiones/:decisionId/ordenes/:ordenId/aprobar",
  ...seguridad,
  aprobarOrden
);

router.post(
  "/decisiones/:decisionId/ordenes/:ordenId/rechazar",
  ...seguridad,
  rechazarOrden
);

module.exports = router;
