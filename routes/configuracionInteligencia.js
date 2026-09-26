"use strict";

const express = require("express");

const authMiddleware = require(
  "../core/auth/auth.middleware"
);

const {
  ROLES_GRUK,
  roleCheck
} = require(
  "../core/auth/roleCheck.middleware"
);

const controller = require(
  "../core/empresa/configuracionInteligencia.controller"
);

const router =
  express.Router();

router.get(
  "/",
  authMiddleware,
  roleCheck(
    ROLES_GRUK.DUENO,
    ROLES_GRUK.ADMIN_SEDE
  ),
  controller.obtener
);

router.put(
  "/",
  authMiddleware,
  roleCheck(
    ROLES_GRUK.DUENO
  ),
  controller.actualizar
);

module.exports =
  router;
