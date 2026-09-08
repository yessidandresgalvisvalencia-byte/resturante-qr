"use strict";

const mongoose = require("mongoose");
const Venta = require("../../models/Venta");

/**
 * Convierte empresaId a ObjectId de forma estricta.
 * Nunca ejecutamos consultas financieras con un tenant inválido.
 */
function validarEmpresaId(empresaId) {
  if (!empresaId) {
    throw new Error(
      "GRUK Finanzas: empresaId requerido"
    );
  }

  if (!mongoose.Types.ObjectId.isValid(empresaId)) {
    throw new Error(
      "GRUK Finanzas: empresaId invalido"
    );
  }

  return new mongoose.Types.ObjectId(
    String(empresaId)
  );
}

/**
 * Resumen financiero determinístico de ventas.
 *
 * REGLA:
 * - ingresos: todas las ventas pagadas del periodo.
 * - margen/utilidad: SOLO ventas cuyo costo fue
 *   congelado explícitamente al momento de la venta.
 *
 * Una venta histórica con costo 0 no se interpreta
 * automáticamente como costo real 0.
 */
async function obtenerResumenVentas({
  empresaId,
  desde,
  hasta
}) {
  const empresaObjectId =
    validarEmpresaId(empresaId);

  if (!(desde instanceof Date) || Number.isNaN(desde.getTime())) {
    throw new Error(
      "GRUK Finanzas: fecha desde invalida"
    );
  }

  if (!(hasta instanceof Date) || Number.isNaN(hasta.getTime())) {
    throw new Error(
      "GRUK Finanzas: fecha hasta invalida"
    );
  }

  if (desde >= hasta) {
    throw new Error(
      "GRUK Finanzas: el periodo financiero es invalido"
    );
  }

  const filtroBase = {
    empresaId: empresaObjectId,
    estado: "pagada",
    fecha: {
      $gte: desde,
      $lt: hasta
    }
  };

  const [totales] = await Venta.aggregate([
    {
      $match: filtroBase
    },
    {
      $group: {
        _id: null,

        ventasTotales: {
          $sum: 1
        },

        ingresosTotales: {
          $sum: "$total"
        },

        ventasConCostoConfiable: {
          $sum: {
            $cond: [
              {
                $eq: [
                  "$metadata.costoCongelado",
                  true
                ]
              },
              1,
              0
            ]
          }
        },

        ingresosConCostoConfiable: {
          $sum: {
            $cond: [
              {
                $eq: [
                  "$metadata.costoCongelado",
                  true
                ]
              },
              "$total",
              0
            ]
          }
        },

        costosConfiables: {
          $sum: {
            $cond: [
              {
                $eq: [
                  "$metadata.costoCongelado",
                  true
                ]
              },
              "$costoTotal",
              0
            ]
          }
        }
      }
    }
  ]);

  const resumen = totales || {
    ventasTotales: 0,
    ingresosTotales: 0,
    ventasConCostoConfiable: 0,
    ingresosConCostoConfiable: 0,
    costosConfiables: 0
  };

  const ventasSinCostoConfiable =
    resumen.ventasTotales -
    resumen.ventasConCostoConfiable;

  const utilidadBrutaConfiable =
    resumen.ingresosConCostoConfiable -
    resumen.costosConfiables;

  const margenBrutoConfiable =
    resumen.ingresosConCostoConfiable > 0
      ? (
          utilidadBrutaConfiable /
          resumen.ingresosConCostoConfiable
        ) * 100
      : null;

  const coberturaCostoPorcentaje =
    resumen.ventasTotales > 0
      ? (
          resumen.ventasConCostoConfiable /
          resumen.ventasTotales
        ) * 100
      : 0;

  return {
    empresaId: String(empresaObjectId),

    periodo: {
      desde,
      hasta
    },

    ventasTotales:
      resumen.ventasTotales,

    ingresosTotales:
      resumen.ingresosTotales,

    ventasConCostoConfiable:
      resumen.ventasConCostoConfiable,

    ventasSinCostoConfiable,

    ingresosConCostoConfiable:
      resumen.ingresosConCostoConfiable,

    costosConfiables:
      resumen.costosConfiables,

    utilidadBrutaConfiable,

    margenBrutoConfiable,

    coberturaCostoPorcentaje
  };
}

module.exports = {
  obtenerResumenVentas
};