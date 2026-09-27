"use strict";

const express = require("express");
const auth = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");
const {
  obtenerGuiaGanancia
} = require("../intelligence/executive/asesorEjecutivo.controller");

const router = express.Router();

router.get(
  "/ganancia/:cierreId",
  auth,
  roleCheck(ROLES_GRUK.DUENO),
  obtenerGuiaGanancia
);

module.exports = router;
