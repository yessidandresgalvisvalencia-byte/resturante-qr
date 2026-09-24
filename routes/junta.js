"use strict";

const express = require("express");
const auth = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");
const {
  abrirJunta,
  intervenir
} = require("../intelligence/board/junta.controller");

const router = express.Router();

const seguridad = [
  auth,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE)
];

router.post(
  "/decisiones/:decisionId/abrir",
  ...seguridad,
  abrirJunta
);

router.post(
  "/sesiones/:sesionId/intervenciones",
  ...seguridad,
  intervenir
);

module.exports = router;
