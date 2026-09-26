"use strict";

const {
  validarObjetivosEmpresa
} = require("./validators/objetivosEmpresa.validator");

const {
  obtenerConfiguracionInteligencia,
  actualizarConfiguracionInteligencia
} = require("./configuracionInteligencia.service");

function responderError(
  res,
  error,
  fallback
) {
  return res
    .status(
      error.statusCode || 500
    )
    .json({
      ok: false,
      error:
        error.message ||
        fallback
    });
}

async function obtener(req, res) {
  try {
    const configuracion =
      await obtenerConfiguracionInteligencia(
        req.auth.empresaId
      );

    return res.json({
      ok: true,
      configuracion
    });
  } catch (error) {
    return responderError(
      res,
      error,
      "Error consultando configuración de inteligencia"
    );
  }
}

async function actualizar(req, res) {
  try {
    const {
      error,
      value
    } =
      validarObjetivosEmpresa(
        req.body
      );

    if (error) {
      return res
        .status(400)
        .json({
          ok: false,
          error:
            "Configuración empresarial inválida",
          detalles:
            error.details.map(
              (item) =>
                item.message
            )
        });
    }

    const configuracion =
      await actualizarConfiguracionInteligencia({
        empresaId:
          req.auth.empresaId,
        valores:
          value,
        updatedBy:
          req.auth.usuarioId
      });

    return res.json({
      ok: true,
      configuracion
    });
  } catch (error) {
    return responderError(
      res,
      error,
      "Error actualizando configuración de inteligencia"
    );
  }
}

module.exports = {
  obtener,
  actualizar
};
