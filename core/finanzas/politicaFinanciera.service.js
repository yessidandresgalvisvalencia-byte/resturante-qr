"use strict";

const mongoose = require("mongoose");
const Empresa = require("../../models/Empresa");
const eventBus = require("../eventos/eventBus");

const CATEGORIAS_POLITICA = Object.freeze([
  "NOMINA",
  "IMPUESTOS",
  "DEUDA",
  "ARRIENDO",
  "SERVICIOS",
  "SEGUROS",
  "LICENCIAS",
  "PROVEEDORES",
  "OTRO"
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
      `${nombre} invalido`
    );
  }

  return new mongoose.Types.ObjectId(
    String(valor)
  );
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function normalizarCategoriaObligacion(item = {}) {
  if (item.origenTipo === "COMPRA") {
    return "PROVEEDORES";
  }

  const categoria =
    normalizarTexto(item.categoria);

  if (!categoria) {
    return item.origenTipo === "RECURRENTE"
      ? "OTRO"
      : "OTRO";
  }

  if (/NOMINA|SALARIO|SUELDO/.test(categoria)) {
    return "NOMINA";
  }

  if (/IMPUEST/.test(categoria)) {
    return "IMPUESTOS";
  }

  if (/DEUDA|CREDITO|PRESTAM/.test(categoria)) {
    return "DEUDA";
  }

  if (/ARRIEND|ALQUILER/.test(categoria)) {
    return "ARRIENDO";
  }

  if (/SERVICIO/.test(categoria)) {
    return "SERVICIOS";
  }

  if (/SEGURO/.test(categoria)) {
    return "SEGUROS";
  }

  if (/LICENCIA/.test(categoria)) {
    return "LICENCIAS";
  }

  if (/PROVEEDOR|COMPRA/.test(categoria)) {
    return "PROVEEDORES";
  }

  return CATEGORIAS_POLITICA.includes(categoria)
    ? categoria
    : "OTRO";
}

function politicaPorDefecto() {
  return {
    usar_precedencia_categoria: false,
    precedencia_categorias: [],
    updatedAt: null,
    updatedBy: null
  };
}

async function obtenerPoliticaPriorizacionPagos(
  empresaId,
  opciones = {}
) {
  const empresa =
    await Empresa.findById(
      objectId(
        empresaId,
        "empresaId"
      )
    )
      .select(
        "configuracion.politica_financiera.priorizacion_pagos"
      )
      .lean();

  if (!empresa) {
    if (
      opciones.permitirAusente
    ) {
      return politicaPorDefecto();
    }

    throw serviceError(
      404,
      "Empresa no encontrada"
    );
  }

  const politica =
    empresa.configuracion
      ?.politica_financiera
      ?.priorizacion_pagos;

  if (!politica) {
    return politicaPorDefecto();
  }

  return {
    usar_precedencia_categoria:
      Boolean(
        politica
          .usar_precedencia_categoria
      ),
    precedencia_categorias:
      Array.isArray(
        politica
          .precedencia_categorias
      )
        ? [
            ...politica
              .precedencia_categorias
          ]
        : [],
    updatedAt:
      politica.updatedAt || null,
    updatedBy:
      politica.updatedBy || null
  };
}

function validarPrecedencia(categorias) {
  if (!Array.isArray(categorias)) {
    throw serviceError(
      400,
      "precedencia_categorias debe ser un arreglo"
    );
  }

  const normalizadas =
    categorias.map(
      (categoria) =>
        normalizarTexto(
          categoria
        )
    );

  if (
    new Set(normalizadas).size !==
    normalizadas.length
  ) {
    throw serviceError(
      400,
      "precedencia_categorias no admite duplicados"
    );
  }

  for (const categoria of normalizadas) {
    if (
      !CATEGORIAS_POLITICA.includes(
        categoria
      )
    ) {
      throw serviceError(
        400,
        `Categoria de politica invalida: ${categoria}`
      );
    }
  }

  return normalizadas;
}

async function actualizarPoliticaPriorizacionPagos({
  empresaId,
  usarPrecedenciaCategoria,
  precedenciaCategorias,
  updatedBy
}) {
  const categorias =
    validarPrecedencia(
      precedenciaCategorias || []
    );

  if (
    usarPrecedenciaCategoria &&
    !categorias.length
  ) {
    throw serviceError(
      400,
      "Para activar precedencia por categoria debes definir al menos una categoria"
    );
  }

  const ahora = new Date();

  const empresa =
    await Empresa.findByIdAndUpdate(
      objectId(
        empresaId,
        "empresaId"
      ),
      {
        $set: {
          "configuracion.politica_financiera.priorizacion_pagos.usar_precedencia_categoria":
            Boolean(
              usarPrecedenciaCategoria
            ),
          "configuracion.politica_financiera.priorizacion_pagos.precedencia_categorias":
            categorias,
          "configuracion.politica_financiera.priorizacion_pagos.updatedAt":
            ahora,
          "configuracion.politica_financiera.priorizacion_pagos.updatedBy":
            objectId(
              updatedBy,
              "updatedBy"
            )
        }
      },
      {
        new: true
      }
    )
      .select(
        "configuracion.politica_financiera.priorizacion_pagos"
      )
      .lean();

  if (!empresa) {
    throw serviceError(
      404,
      "Empresa no encontrada"
    );
  }

  eventBus.emit(
    "POLITICA_FINANCIERA_ACTUALIZADA",
    {
      empresaId:
        objectId(
          empresaId,
          "empresaId"
        ),
      usarPrecedenciaCategoria:
        Boolean(
          usarPrecedenciaCategoria
        ),
      precedenciaCategorias:
        categorias,
      updatedBy:
        objectId(
          updatedBy,
          "updatedBy"
        )
    }
  );

  return empresa.configuracion
    ?.politica_financiera
    ?.priorizacion_pagos;
}

function indiceCategoria(
  item,
  politica
) {
  if (
    !politica
      ?.usar_precedencia_categoria
  ) {
    return Number.MAX_SAFE_INTEGER;
  }

  const categoria =
    normalizarCategoriaObligacion(
      item
    );

  const indice =
    (
      politica
        .precedencia_categorias || []
    ).indexOf(
      categoria
    );

  return indice >= 0
    ? indice
    : Number.MAX_SAFE_INTEGER - 1;
}

module.exports = {
  CATEGORIAS_POLITICA,
  politicaPorDefecto,
  normalizarCategoriaObligacion,
  obtenerPoliticaPriorizacionPagos,
  actualizarPoliticaPriorizacionPagos,
  indiceCategoria,
  validarPrecedencia
};
