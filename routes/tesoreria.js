"use strict";

const express = require("express");
const Joi = require("joi");
const mongoose = require("mongoose");

const Sede = require("../models/sede");
const authMiddleware = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");
const {
  crearCuenta,
  listarCuentas,
  obtenerResumenTesoreria,
  transferir
} = require("../core/finanzas/tesoreria.service");
const {
  construirProyeccionTesoreria
} = require("../core/finanzas/tesoreriaProyeccion.service");

const router = express.Router();

const seguridad = [
  authMiddleware,
  roleCheck(
    ROLES_GRUK.DUENO,
    ROLES_GRUK.ADMIN_SEDE
  )
];

const cuentaSchema = Joi.object({
  sedeId: Joi.string()
    .trim()
    .allow(null, "")
    .optional(),
  nombre: Joi.string()
    .trim()
    .min(2)
    .max(120)
    .required(),
  tipo: Joi.string()
    .valid(
      "EFECTIVO",
      "BANCO",
      "BILLETERA",
      "OTRO"
    )
    .required(),
  saldoInicial: Joi.number()
    .required(),
  saldoInicialAt: Joi.date()
    .iso()
    .required(),
  metodosPagoAsociados:
    Joi.array()
      .items(
        Joi.string().valid(
          "efectivo",
          "transferencia",
          "tarjeta",
          "nequi",
          "daviplata",
          "otro"
        )
      )
      .unique()
      .max(6)
      .default([]),
  esPrincipal: Joi.boolean()
    .default(false),
  permiteSaldoNegativo:
    Joi.boolean()
      .default(false)
})
  .required()
  .unknown(false);

const transferenciaSchema =
  Joi.object({
    cuentaOrigenId:
      Joi.string()
        .trim()
        .required(),
    cuentaDestinoId:
      Joi.string()
        .trim()
        .required(),
    monto:
      Joi.number()
        .positive()
        .required(),
    concepto:
      Joi.string()
        .trim()
        .max(500)
        .allow("")
        .default(
          "Transferencia interna"
        )
  })
    .required()
    .unknown(false);

async function resolverSedeScope(
  req,
  sedeSolicitada = null
) {
  if (
    req.auth.rol ===
    ROLES_GRUK.ADMIN_SEDE
  ) {
    if (!req.auth.sedeId) {
      const error = new Error(
        "ADMIN_SEDE requiere una sede autorizada"
      );
      error.statusCode = 403;
      throw error;
    }

    if (
      sedeSolicitada &&
      String(sedeSolicitada) !==
        String(req.auth.sedeId)
    ) {
      const error = new Error(
        "No tienes acceso a otra sede"
      );
      error.statusCode = 403;
      throw error;
    }

    return req.auth.sedeId;
  }

  if (!sedeSolicitada) {
    return null;
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      sedeSolicitada
    )
  ) {
    const error = new Error(
      "sedeId invalido"
    );
    error.statusCode = 400;
    throw error;
  }

  const sede =
    await Sede.findOne({
      _id:
        sedeSolicitada,
      empresaId:
        req.auth.empresaId
    })
      .select("_id")
      .lean();

  if (!sede) {
    const error = new Error(
      "Sede fuera del tenant autorizado"
    );
    error.statusCode = 403;
    throw error;
  }

  return sede._id;
}

function responderError(
  res,
  error,
  mensaje
) {
  const statusCode =
    Number.isInteger(
      error?.statusCode
    )
      ? error.statusCode
      : error?.code === 11000
        ? 409
        : 500;

  if (statusCode >= 500) {
    console.error(
      `[GRUK TESORERIA] ${mensaje}:`,
      error
    );
  }

  return res.status(
    statusCode
  ).json({
    ok: false,
    error:
      error?.code === 11000
        ? "Ya existe una cuenta con ese nombre en el mismo alcance"
        : statusCode >= 500
          ? mensaje
          : error.message
  });
}

router.get(
  "/resumen",
  ...seguridad,
  async (req, res) => {
    try {
      const sedeId =
        await resolverSedeScope(
          req,
          req.query.sedeId || null
        );

      const resumen =
        await obtenerResumenTesoreria({
          empresaId:
            req.auth.empresaId,
          sedeId
        });

      const proyeccion =
        await construirProyeccionTesoreria({
          empresaId:
            req.auth.empresaId,
          sedeId,
          tesoreria:
            resumen
        });

      return res.json({
        ok: true,
        resumen,
        proyeccion
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error consultando tesoreria"
      );
    }
  }
);

router.get(
  "/cuentas",
  ...seguridad,
  async (req, res) => {
    try {
      const sedeId =
        await resolverSedeScope(
          req,
          req.query.sedeId || null
        );

      const cuentas =
        await listarCuentas({
          empresaId:
            req.auth.empresaId,
          sedeId
        });

      return res.json({
        ok: true,
        cuentas
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error consultando cuentas de tesoreria"
      );
    }
  }
);

router.post(
  "/cuentas",
  ...seguridad,
  async (req, res) => {
    try {
      const {
        error,
        value
      } = cuentaSchema.validate(
        req.body,
        {
          abortEarly: false,
          stripUnknown: false,
          convert: true
        }
      );

      if (error) {
        return res.status(400).json({
          ok: false,
          error:
            error.details
              .map(
                (item) =>
                  item.message
              )
              .join("; ")
        });
      }

      const sedeId =
        await resolverSedeScope(
          req,
          value.sedeId || null
        );

      const cuenta =
        await crearCuenta({
          empresaId:
            req.auth.empresaId,
          sedeId,
          nombre:
            value.nombre,
          tipo:
            value.tipo,
          saldoInicial:
            value.saldoInicial,
          saldoInicialAt:
            value.saldoInicialAt,
          metodosPagoAsociados:
            value.metodosPagoAsociados,
          esPrincipal:
            value.esPrincipal,
          permiteSaldoNegativo:
            value.permiteSaldoNegativo,
          createdBy:
            req.auth.usuarioId
        });

      return res.status(201).json({
        ok: true,
        cuenta
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error creando cuenta de tesoreria"
      );
    }
  }
);

router.post(
  "/transferencias",
  ...seguridad,
  async (req, res) => {
    try {
      const {
        error,
        value
      } =
        transferenciaSchema.validate(
          req.body,
          {
            abortEarly: false,
            stripUnknown: false,
            convert: true
          }
        );

      if (error) {
        return res.status(400).json({
          ok: false,
          error:
            error.details
              .map(
                (item) =>
                  item.message
              )
              .join("; ")
        });
      }

      const sedeScopeId =
        req.auth.rol ===
        ROLES_GRUK.ADMIN_SEDE
          ? await resolverSedeScope(
              req,
              req.auth.sedeId
            )
          : null;

      const transferencia =
        await transferir({
          empresaId:
            req.auth.empresaId,
          sedeScopeId,
          cuentaOrigenId:
            value.cuentaOrigenId,
          cuentaDestinoId:
            value.cuentaDestinoId,
          monto:
            value.monto,
          concepto:
            value.concepto,
          createdBy:
            req.auth.usuarioId
        });

      return res.status(201).json({
        ok: true,
        transferencia
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error realizando transferencia interna"
      );
    }
  }
);

module.exports = router;
