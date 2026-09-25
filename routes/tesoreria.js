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
  obtenerObligacionesRegistradas
} = require("../core/finanzas/obligaciones.service");
const {
  crearObligacionRecurrente,
  listarObligacionesRecurrentes,
  desactivarObligacionRecurrente
} = require("../core/finanzas/obligacionesRecurrentes.service");
const {
  construirProyeccionTesoreria
} = require("../core/finanzas/tesoreriaProyeccion.service");
const {
  CATEGORIAS_POLITICA,
  obtenerPoliticaPriorizacionPagos,
  actualizarPoliticaPriorizacionPagos
} = require("../core/finanzas/politicaFinanciera.service");
const {
  listarExcepcionesActivas,
  crearExcepcionPrioridadPago,
  revocarExcepcionPrioridadPago
} = require("../core/finanzas/excepcionesPrioridadPago.service");
const {
  obtenerPoliticaDistribucionDueno,
  actualizarPoliticaDistribucionDueno,
  cerrarPeriodoMensual,
  calcularDistribucionDueno,
  crearPropuestaReservaDueno,
  aprobarReservaDueno,
  listarReservas
} = require("../core/finanzas/distribucionDueno.service");

const router = express.Router();

const seguridad = [
  authMiddleware,
  roleCheck(
    ROLES_GRUK.DUENO,
    ROLES_GRUK.ADMIN_SEDE
  )
];

const seguridadDueno = [
  authMiddleware,
  roleCheck(
    ROLES_GRUK.DUENO
  )
];

const excepcionPrioridadPagoSchema =
  Joi.object({
    sedeId: Joi.string()
      .trim()
      .allow(null, "")
      .optional(),
    origenTipo: Joi.string()
      .valid(
        "COMPRA",
        "GASTO",
        "RECURRENTE"
      )
      .required(),
    origenId: Joi.string()
      .trim()
      .required(),
    motivo: Joi.string()
      .trim()
      .min(10)
      .max(1000)
      .required(),
    expiresAt: Joi.date()
      .iso()
      .greater("now")
      .required()
  })
    .required()
    .unknown(false);

const politicaPagosSchema =
  Joi.object({
    usar_precedencia_categoria:
      Joi.boolean()
        .required(),
    precedencia_categorias:
      Joi.array()
        .items(
          Joi.string().valid(
            ...CATEGORIAS_POLITICA
          )
        )
        .unique()
        .max(
          CATEGORIAS_POLITICA.length
        )
        .required()
  })
    .required()
    .unknown(false);

const politicaDistribucionDuenoSchema =
  Joi.object({
    habilitada:
      Joi.boolean()
        .required(),
    porcentaje_utilidad:
      Joi.number()
        .min(0)
        .max(100)
        .required(),
    reserva_minima_caja:
      Joi.number()
        .min(0)
        .required()
  })
    .required()
    .unknown(false);

const cierreMensualSchema =
  Joi.object({
    periodo:
      Joi.string()
        .pattern(
          /^\d{4}-\d{2}$/
        )
        .required()
  })
    .required()
    .unknown(false);

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

const obligacionRecurrenteSchema =
  Joi.object({
    sedeId: Joi.string()
      .trim()
      .allow(null, "")
      .optional(),
    nombre: Joi.string()
      .trim()
      .min(2)
      .max(160)
      .required(),
    categoria: Joi.string()
      .valid(
        "NOMINA",
        "ARRIENDO",
        "SERVICIOS",
        "IMPUESTOS",
        "DEUDA",
        "SEGUROS",
        "LICENCIAS",
        "OTRO"
      )
      .required(),
    monto: Joi.number()
      .positive()
      .required(),
    frecuencia: Joi.string()
      .valid(
        "SEMANAL",
        "QUINCENAL",
        "MENSUAL",
        "BIMESTRAL",
        "TRIMESTRAL",
        "SEMESTRAL",
        "ANUAL"
      )
      .required(),
    proximoVencimiento:
      Joi.date()
        .iso()
        .required(),
    fechaFin: Joi.date()
      .iso()
      .allow(null, "")
      .optional(),
    tercero: Joi.string()
      .trim()
      .max(160)
      .allow("")
      .default(""),
    notas: Joi.string()
      .trim()
      .max(1000)
      .allow("")
      .default(""),
    fuenteMonto: Joi.string()
      .valid(
        "CONTRATO",
        "HISTORICO",
        "ESTIMADO_MANUAL",
        "OTRO"
      )
      .required()
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
  "/distribucion-dueno/politica",
  ...seguridadDueno,
  async (req, res) => {
    try {
      const politica =
        await obtenerPoliticaDistribucionDueno(
          req.auth.empresaId
        );

      return res.json({
        ok: true,
        politica
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error consultando politica de distribucion"
      );
    }
  }
);

router.put(
  "/distribucion-dueno/politica",
  ...seguridadDueno,
  async (req, res) => {
    try {
      const {
        error,
        value
      } =
        politicaDistribucionDuenoSchema.validate(
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

      const politica =
        await actualizarPoliticaDistribucionDueno({
          empresaId:
            req.auth.empresaId,
          habilitada:
            value.habilitada,
          porcentajeUtilidad:
            value.porcentaje_utilidad,
          reservaMinimaCaja:
            value.reserva_minima_caja,
          updatedBy:
            req.auth.usuarioId
        });

      return res.json({
        ok: true,
        politica
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error actualizando politica de distribucion"
      );
    }
  }
);

router.post(
  "/distribucion-dueno/cierres",
  ...seguridadDueno,
  async (req, res) => {
    try {
      const {
        error,
        value
      } =
        cierreMensualSchema.validate(
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

      const cierre =
        await cerrarPeriodoMensual({
          empresaId:
            req.auth.empresaId,
          periodo:
            value.periodo,
          createdBy:
            req.auth.usuarioId
        });

      const calculo =
        await calcularDistribucionDueno({
          empresaId:
            req.auth.empresaId,
          cierreId:
            cierre._id
        });

      let propuesta = null;

      if (
        calculo.estado ===
          "DISTRIBUIBLE" &&
        calculo.montoPropuesto > 0
      ) {
        propuesta =
          await crearPropuestaReservaDueno({
            empresaId:
              req.auth.empresaId,
            cierreId:
              cierre._id,
            createdBy:
              req.auth.usuarioId
          });
      }

      return res.status(201).json({
        ok: true,
        cierre,
        calculo,
        propuesta:
          propuesta?.reserva || null
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error cerrando periodo financiero"
      );
    }
  }
);

router.get(
  "/distribucion-dueno/reservas",
  ...seguridadDueno,
  async (req, res) => {
    try {
      const reservas =
        await listarReservas({
          empresaId:
            req.auth.empresaId
        });

      return res.json({
        ok: true,
        reservas
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error consultando reservas de caja"
      );
    }
  }
);

router.post(
  "/distribucion-dueno/reservas/:id/aprobar",
  ...seguridadDueno,
  async (req, res) => {
    try {
      const reserva =
        await aprobarReservaDueno({
          empresaId:
            req.auth.empresaId,
          reservaId:
            req.params.id,
          approvedBy:
            req.auth.usuarioId
        });

      return res.json({
        ok: true,
        reserva
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error aprobando reserva del dueño"
      );
    }
  }
);

router.get(
  "/excepciones-prioridad-pago",
  ...seguridad,
  async (req, res) => {
    try {
      const sedeId =
        await resolverSedeScope(
          req,
          req.query.sedeId || null
        );

      const excepciones =
        await listarExcepcionesActivas({
          empresaId:
            req.auth.empresaId,
          sedeId
        });

      return res.json({
        ok: true,
        excepciones
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error consultando excepciones de prioridad"
      );
    }
  }
);

router.post(
  "/excepciones-prioridad-pago",
  ...seguridadDueno,
  async (req, res) => {
    try {
      const {
        error,
        value
      } =
        excepcionPrioridadPagoSchema.validate(
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

      const excepcion =
        await crearExcepcionPrioridadPago({
          empresaId:
            req.auth.empresaId,
          sedeId,
          origenTipo:
            value.origenTipo,
          origenId:
            value.origenId,
          motivo:
            value.motivo,
          expiresAt:
            value.expiresAt,
          createdBy:
            req.auth.usuarioId
        });

      return res.status(201).json({
        ok: true,
        excepcion
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error creando excepcion de prioridad"
      );
    }
  }
);

router.delete(
  "/excepciones-prioridad-pago/:id",
  ...seguridadDueno,
  async (req, res) => {
    try {
      const excepcion =
        await revocarExcepcionPrioridadPago({
          empresaId:
            req.auth.empresaId,
          excepcionId:
            req.params.id,
          revokedBy:
            req.auth.usuarioId
        });

      return res.json({
        ok: true,
        excepcion
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error revocando excepcion de prioridad"
      );
    }
  }
);

router.get(
  "/politica-priorizacion-pagos",
  ...seguridad,
  async (req, res) => {
    try {
      const politica =
        await obtenerPoliticaPriorizacionPagos(
          req.auth.empresaId
        );

      return res.json({
        ok: true,
        politica,
        categoriasDisponibles:
          CATEGORIAS_POLITICA
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error consultando politica financiera"
      );
    }
  }
);

router.put(
  "/politica-priorizacion-pagos",
  ...seguridadDueno,
  async (req, res) => {
    try {
      const {
        error,
        value
      } =
        politicaPagosSchema.validate(
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

      const politica =
        await actualizarPoliticaPriorizacionPagos({
          empresaId:
            req.auth.empresaId,
          usarPrecedenciaCategoria:
            value
              .usar_precedencia_categoria,
          precedenciaCategorias:
            value
              .precedencia_categorias,
          updatedBy:
            req.auth.usuarioId
        });

      return res.json({
        ok: true,
        politica
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error actualizando politica financiera"
      );
    }
  }
);

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
  "/obligaciones-recurrentes",
  ...seguridad,
  async (req, res) => {
    try {
      const sedeId =
        await resolverSedeScope(
          req,
          req.query.sedeId || null
        );

      const obligaciones =
        await listarObligacionesRecurrentes({
          empresaId:
            req.auth.empresaId,
          sedeId
        });

      return res.json({
        ok: true,
        obligaciones
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error consultando obligaciones recurrentes"
      );
    }
  }
);

router.post(
  "/obligaciones-recurrentes",
  ...seguridad,
  async (req, res) => {
    try {
      const {
        error,
        value
      } =
        obligacionRecurrenteSchema.validate(
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

      const obligacion =
        await crearObligacionRecurrente({
          empresaId:
            req.auth.empresaId,
          sedeId,
          nombre:
            value.nombre,
          categoria:
            value.categoria,
          monto:
            value.monto,
          frecuencia:
            value.frecuencia,
          proximoVencimiento:
            value.proximoVencimiento,
          fechaFin:
            value.fechaFin || null,
          tercero:
            value.tercero,
          notas:
            value.notas,
          fuenteMonto:
            value.fuenteMonto,
          createdBy:
            req.auth.usuarioId
        });

      return res.status(201).json({
        ok: true,
        obligacion
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error creando obligación recurrente"
      );
    }
  }
);

router.delete(
  "/obligaciones-recurrentes/:id",
  ...seguridad,
  async (req, res) => {
    try {
      const sedeId =
        req.auth.rol ===
        ROLES_GRUK.ADMIN_SEDE
          ? await resolverSedeScope(
              req,
              req.auth.sedeId
            )
          : null;

      const obligacion =
        await desactivarObligacionRecurrente({
          empresaId:
            req.auth.empresaId,
          sedeId,
          obligacionId:
            req.params.id
        });

      return res.json({
        ok: true,
        obligacion
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error desactivando obligación recurrente"
      );
    }
  }
);

router.get(
  "/obligaciones",
  ...seguridad,
  async (req, res) => {
    try {
      const sedeId =
        await resolverSedeScope(
          req,
          req.query.sedeId || null
        );

      const obligaciones =
        await obtenerObligacionesRegistradas({
          empresaId:
            req.auth.empresaId,
          sedeId
        });

      return res.json({
        ok: true,
        obligaciones
      });
    } catch (error) {
      return responderError(
        res,
        error,
        "Error consultando obligaciones registradas"
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
