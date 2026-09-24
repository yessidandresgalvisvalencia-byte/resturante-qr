"use strict";

const express = require("express");
const auth = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");
const {
  obtenerJunta,
  abrirJunta,
  intervenir,
  reintentarRespuesta,
  cerrarJunta
} = require("../intelligence/board/junta.controller");

const router = express.Router();

const seguridad = [
  auth,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE)
];

router.get(
  "/decisiones/:decisionId",
  ...seguridad,
  obtenerJunta
);

router.post(
  "/decisiones/:decisionId/abrir",
  ...seguridad,
  abrirJunta
);

router.post(
  "/sesiones/:sesionId/cerrar",
  ...seguridad,
  cerrarJunta
);

router.post(
  "/sesiones/:sesionId/intervenciones",
  ...seguridad,
  intervenir
);

router.post(
  "/sesiones/:sesionId/intervenciones/:intervencionId/responder",
  ...seguridad,
  reintentarRespuesta
);

module.exports = router;
