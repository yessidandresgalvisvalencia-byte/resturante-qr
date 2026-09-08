"use strict";

const Joi = require("joi");

const objetivosEmpresaSchema = Joi.object({
  margen_objetivo: Joi.number()
    .min(0)
    .max(100)
    .required(),

  punto_equilibrio: Joi.number()
    .min(0)
    .required(),

  ticket_objetivo: Joi.number()
    .min(0)
    .required(),

  cac_maximo: Joi.number()
    .min(0)
    .required(),

  empleados_actuales: Joi.number()
    .integer()
    .min(0)
    .required()
}).required();

function validarObjetivosEmpresa(datos) {
  return objetivosEmpresaSchema.validate(datos, {
    abortEarly: false,
    allowUnknown: false,
    convert: true
  });
}

module.exports = {
  validarObjetivosEmpresa
};
