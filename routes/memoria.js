"use strict";

const express = require("express");
const auth = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");
const {
  listarMemorias
} = require("../intelligence/memory/memoria.controller");

const router = express.Router();

router.get(
  "/",
  auth,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  listarMemorias
);

module.exports = router;
