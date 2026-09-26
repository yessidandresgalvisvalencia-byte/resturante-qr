"use strict";

const express = require("express");
const Empresa = require("../models/Empresa");
const authMiddleware = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");

const router = express.Router();

router.get(
  "/contexto",
  authMiddleware,
  roleCheck(
    ROLES_GRUK.DUENO,
    ROLES_GRUK.ADMIN_SEDE,
    ROLES_GRUK.EMPLEADO
  ),
  async (req, res) => {
    try {
      const empresa =
        await Empresa.findById(
          req.auth.empresaId
        )
          .select(
            "empresaId nombre tipoNegocio verticalOperativa estado modulos configuracion.moneda configuracion.pais configuracion.zonaHoraria"
          )
          .lean();

      if (!empresa) {
        return res.status(404).json({
          ok: false,
          error:
            "Empresa no encontrada"
        });
      }

      return res.json({
        ok: true,
        empresa: {
          id:
            empresa._id,
          empresaId:
            empresa.empresaId,
          nombre:
            empresa.nombre,
          tipoNegocio:
            empresa.tipoNegocio,
          vertical:
            empresa.verticalOperativa ||
            (
              empresa.tipoNegocio ===
              "restaurante"
                ? "restaurante"
                : "generico"
            ),
          estado:
            empresa.estado,
          modulos:
            empresa.modulos || {},
          configuracion: {
            moneda:
              empresa.configuracion
                ?.moneda || "COP",
            pais:
              empresa.configuracion
                ?.pais || "CO",
            zonaHoraria:
              empresa.configuracion
                ?.zonaHoraria ||
              "America/Bogota"
          },
          contextoVertical: {
            restaurantId:
              req.auth.restaurantId ||
              null
          }
        }
      });
    } catch (error) {
      console.error(
        "Error consultando contexto de empresa:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Error consultando contexto de empresa"
      });
    }
  }
);

module.exports = router;
