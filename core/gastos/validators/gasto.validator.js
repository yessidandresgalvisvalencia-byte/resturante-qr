"use strict";

const Joi = require("joi");

const gastoSchema = Joi.object({
  empresaId: Joi.string()
    .hex()
    .length(24)
    .required(),

  sedeId: Joi.string()
    .hex()
    .length(24)
    .allow(null, "")
    .optional(),

  concepto: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required(),

  categoria: Joi.string()
    .trim()
    .min(1)
    .max(80)
    .required(),

  monto: Joi.number()
    .min(0)
    .required(),

  metodoPago: Joi.string()
    .trim()
    .max(80)
    .allow("")
    .optional(),

  estadoPago: Joi.string()
    .valid(
      "desconocido",
      "pendiente",
      "pagado"
    )
    .default("desconocido"),

  proveedor: Joi.string()
    .trim()
    .max(200)
    .allow("")
    .optional(),

  fecha: Joi.date()
    .iso()
    .optional(),

  origen: Joi.string()
    .valid("manual", "finanzas_gruk")
    .default("manual"),

  metadata: Joi.object({
    impacto: Joi.string()
      .valid("bajo", "medio", "alto")
      .optional(),

    objetivo: Joi.string()
      .valid("ventas", "operacion", "fidelizacion")
      .optional(),

    observacion: Joi.string()
      .trim()
      .max(1000)
      .allow("")
      .optional(),

    gastoPertenece: Joi.string()
      .max(50)
      .allow("")
      .optional(),

    restauranteBeneficiado: Joi.string()
      .trim()
      .max(200)
      .allow("")
      .optional(),

    pedidoRelacionado: Joi.string()
      .trim()
      .max(200)
      .allow("")
      .optional(),

    esCostoRecuperable: Joi.boolean()
      .optional(),

    cajaReferencia: Joi.string()
      .trim()
      .max(200)
      .allow("")
      .optional()
  })
    .unknown(false)
    .default({})
}).required();

const estadoPagoSchema = Joi.object({
  estadoPago: Joi.string()
    .valid(
      "desconocido",
      "pendiente",
      "pagado"
    )
    .required()
}).required();

function validarGasto(datos) {
  return gastoSchema.validate(datos, {
    abortEarly: false,
    allowUnknown: false,
    convert: true
  });
}

function validarEstadoPagoGasto(datos) {
  return estadoPagoSchema.validate(datos, {
    abortEarly: false,
    allowUnknown: false,
    convert: true
  });
}

module.exports = {
  validarGasto,
  validarEstadoPagoGasto
};
