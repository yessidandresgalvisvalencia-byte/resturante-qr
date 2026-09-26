"use strict";

const mongoose = require("mongoose");
const Empresa = require("../../models/Empresa");
const eventBus = require("../eventos/eventBus");

const CAMPOS_BASE = Object.freeze([
  {
    campo: "margen_objetivo",
    etiqueta: "Margen objetivo",
    unidad: "%"
  },
  {
    campo: "punto_equilibrio",
    etiqueta: "Punto de equilibrio",
    unidad: "COP"
  },
  {
    campo: "ticket_objetivo",
    etiqueta: "Ticket objetivo",
    unidad: "COP"
  },
  {
    campo: "cac_maximo",
    etiqueta: "CAC máximo",
    unidad: "COP"
  },
  {
    campo: "empleados_actuales",
    etiqueta: "Empleados actuales",
    unidad: "personas"
  }
]);

function serviceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function objectId(valor, nombre) {
  if (!mongoose.Types.ObjectId.isValid(valor)) {
    throw serviceError(
      400,
      `${nombre} inválido`
    );
  }

  return new mongoose.Types.ObjectId(
    String(valor)
  );
}

function valorConfigurado(valor) {
  return (
    valor !== null &&
    valor !== undefined &&
    Number.isFinite(Number(valor))
  );
}

function construirEstado(configuracion) {
  const valores = {};

  const faltantes = [];

  for (const item of CAMPOS_BASE) {
    const valor =
      configuracion?.[item.campo];

    valores[item.campo] =
      valorConfigurado(valor)
        ? Number(valor)
        : null;

    if (!valorConfigurado(valor)) {
      faltantes.push({
        campo: item.campo,
        etiqueta: item.etiqueta,
        unidad: item.unidad
      });
    }
  }

  const configurados =
    CAMPOS_BASE.length -
    faltantes.length;

  return {
    completo:
      faltantes.length === 0,
    configurados,
    total:
      CAMPOS_BASE.length,
    porcentaje:
      Math.round(
        (
          configurados /
          CAMPOS_BASE.length
        ) *
        100
      ),
    faltantes,
    valores,
    updatedAt:
      configuracion
        ?.inteligencia_base_actualizadaAt ||
      null,
    updatedBy:
      configuracion
        ?.inteligencia_base_actualizadaBy ||
      null
  };
}

async function obtenerConfiguracionInteligencia(
  empresaId
) {
  const empresa =
    await Empresa.findById(
      objectId(
        empresaId,
        "empresaId"
      )
    )
      .select(
        "configuracion.margen_objetivo configuracion.punto_equilibrio configuracion.ticket_objetivo configuracion.cac_maximo configuracion.empleados_actuales configuracion.inteligencia_base_actualizadaAt configuracion.inteligencia_base_actualizadaBy"
      )
      .lean();

  if (!empresa) {
    throw serviceError(
      404,
      "Empresa no encontrada"
    );
  }

  return construirEstado(
    empresa.configuracion || {}
  );
}

async function actualizarConfiguracionInteligencia({
  empresaId,
  valores,
  updatedBy
}) {
  const empresaObjectId =
    objectId(
      empresaId,
      "empresaId"
    );

  const usuarioObjectId =
    objectId(
      updatedBy,
      "updatedBy"
    );

  const ahora =
    new Date();

  const update = {
    "configuracion.inteligencia_base_actualizadaAt":
      ahora,
    "configuracion.inteligencia_base_actualizadaBy":
      usuarioObjectId
  };

  for (const item of CAMPOS_BASE) {
    update[
      `configuracion.${item.campo}`
    ] = Number(
      valores[item.campo]
    );
  }

  const empresa =
    await Empresa.findOneAndUpdate(
      {
        _id:
          empresaObjectId,
        estado:
          "activa"
      },
      {
        $set:
          update
      },
      {
        new: true
      }
    )
      .select(
        "configuracion.margen_objetivo configuracion.punto_equilibrio configuracion.ticket_objetivo configuracion.cac_maximo configuracion.empleados_actuales configuracion.inteligencia_base_actualizadaAt configuracion.inteligencia_base_actualizadaBy"
      )
      .lean();

  if (!empresa) {
    throw serviceError(
      404,
      "Empresa activa no encontrada"
    );
  }

  const estado =
    construirEstado(
      empresa.configuracion || {}
    );

  eventBus.emit(
    "CONFIGURACION_INTELIGENCIA_ACTUALIZADA",
    {
      empresaId:
        empresaObjectId,
      updatedBy:
        usuarioObjectId,
      completo:
        estado.completo,
      faltantes:
        estado.faltantes.map(
          (item) =>
            item.campo
        )
    }
  );

  return estado;
}

module.exports = {
  CAMPOS_BASE,
  construirEstado,
  obtenerConfiguracionInteligencia,
  actualizarConfiguracionInteligencia
};
