"use strict";

const mongoose = require("mongoose");

const Empresa = require("../../models/Empresa");
const ReservaCaja = require("./models/ReservaCaja");
const CierreFinancieroMensual = require(
  "./models/CierreFinancieroMensual"
);
const {
  obtenerResumenVentas,
  obtenerResumenGastos
} = require("./finanzas.service");
const {
  construirProyeccionTesoreria
} = require("./tesoreriaProyeccion.service");
const eventBus = require("../eventos/eventBus");

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

function limitesPeriodo(periodo) {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      String(periodo || "")
    );

  if (!match) {
    throw serviceError(
      400,
      "Periodo invalido. Usa YYYY-MM"
    );
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  if (
    month < 1 ||
    month > 12
  ) {
    throw serviceError(
      400,
      "Mes invalido"
    );
  }

  const desde =
    new Date(
      Date.UTC(
        year,
        month - 1,
        1,
        0,
        0,
        0,
        0
      )
    );

  const hasta =
    new Date(
      Date.UTC(
        year,
        month,
        1,
        0,
        0,
        0,
        0
      )
    );

  const inicioMesActual =
    new Date();

  inicioMesActual.setUTCDate(1);
  inicioMesActual.setUTCHours(
    0,
    0,
    0,
    0
  );

  if (
    hasta >
    inicioMesActual
  ) {
    throw serviceError(
      409,
      "Solo se pueden cerrar periodos mensuales ya finalizados"
    );
  }

  return {
    periodo:
      `${year}-${String(month).padStart(2, "0")}`,
    desde,
    hasta
  };
}

async function obtenerPoliticaDistribucionDueno(
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
        "configuracion.politica_financiera.distribucion_dueno"
      )
      .lean();

  if (!empresa) {
    throw serviceError(
      404,
      "Empresa no encontrada"
    );
  }

  const p =
    empresa.configuracion
      ?.politica_financiera
      ?.distribucion_dueno || {};

  return {
    habilitada:
      Boolean(
        p.habilitada
      ),
    porcentaje_utilidad:
      Number(
        p.porcentaje_utilidad || 0
      ),
    reserva_minima_caja:
      Number(
        p.reserva_minima_caja || 0
      ),
    updatedAt:
      p.updatedAt || null,
    updatedBy:
      p.updatedBy || null
  };
}

async function actualizarPoliticaDistribucionDueno({
  empresaId,
  habilitada,
  porcentajeUtilidad,
  reservaMinimaCaja,
  updatedBy
}) {
  const porcentaje =
    Number(
      porcentajeUtilidad
    );

  const reservaMinima =
    Number(
      reservaMinimaCaja
    );

  if (
    !Number.isFinite(
      porcentaje
    ) ||
    porcentaje < 0 ||
    porcentaje > 100
  ) {
    throw serviceError(
      400,
      "porcentaje_utilidad debe estar entre 0 y 100"
    );
  }

  if (
    !Number.isFinite(
      reservaMinima
    ) ||
    reservaMinima < 0
  ) {
    throw serviceError(
      400,
      "reserva_minima_caja invalida"
    );
  }

  if (
    habilitada &&
    porcentaje <= 0
  ) {
    throw serviceError(
      400,
      "Para habilitar distribucion debes definir un porcentaje mayor que 0"
    );
  }

  const ahora =
    new Date();

  const empresa =
    await Empresa.findByIdAndUpdate(
      objectId(
        empresaId,
        "empresaId"
      ),
      {
        $set: {
          "configuracion.politica_financiera.distribucion_dueno.habilitada":
            Boolean(
              habilitada
            ),
          "configuracion.politica_financiera.distribucion_dueno.porcentaje_utilidad":
            porcentaje,
          "configuracion.politica_financiera.distribucion_dueno.reserva_minima_caja":
            reservaMinima,
          "configuracion.politica_financiera.distribucion_dueno.updatedAt":
            ahora,
          "configuracion.politica_financiera.distribucion_dueno.updatedBy":
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
        "configuracion.politica_financiera.distribucion_dueno"
      )
      .lean();

  if (!empresa) {
    throw serviceError(
      404,
      "Empresa no encontrada"
    );
  }

  eventBus.emit(
    "POLITICA_DISTRIBUCION_DUENO_ACTUALIZADA",
    {
      empresaId:
        objectId(
          empresaId,
          "empresaId"
        ),
      habilitada:
        Boolean(
          habilitada
        ),
      porcentajeUtilidad:
        porcentaje,
      reservaMinimaCaja:
        reservaMinima,
      updatedBy:
        objectId(
          updatedBy,
          "updatedBy"
        )
    }
  );

  return obtenerPoliticaDistribucionDueno(
    empresaId
  );
}

async function cerrarPeriodoMensual({
  empresaId,
  periodo,
  createdBy
}) {
  const empresaObjectId =
    objectId(
      empresaId,
      "empresaId"
    );

  const usuarioObjectId =
    objectId(
      createdBy,
      "createdBy"
    );

  const limites =
    limitesPeriodo(
      periodo
    );

  const existente =
    await CierreFinancieroMensual.findOne({
      empresaId:
        empresaObjectId,
      periodo:
        limites.periodo,
      sedeId: null,
      deletedAt: null
    }).lean();

  if (existente) {
    return existente;
  }

  const [
    ventas,
    gastos
  ] = await Promise.all([
    obtenerResumenVentas({
      empresaId:
        empresaObjectId,
      desde:
        limites.desde,
      hasta:
        limites.hasta
    }),

    obtenerResumenGastos({
      empresaId:
        empresaObjectId,
      desde:
        limites.desde,
      hasta:
        limites.hasta
    })
  ]);

  const coberturaCompleta =
    Number(
      ventas
        .coberturaCostoPorcentaje || 0
    ) === 100;

  const utilidadOperacional =
    coberturaCompleta
      ? Number(
          ventas.utilidadBrutaConfiable || 0
        ) -
        Number(
          gastos.montoGastosRegistrados || 0
        )
      : null;

  const cierre =
    await CierreFinancieroMensual.create({
      empresaId:
        empresaObjectId,
      sedeId: null,
      periodo:
        limites.periodo,
      desde:
        limites.desde,
      hasta:
        limites.hasta,
      ventasTotales:
        Number(
          ventas.ventasTotales || 0
        ),
      ingresosTotales:
        Number(
          ventas.ingresosTotales || 0
        ),
      costosConfiables:
        Number(
          ventas.costosConfiables || 0
        ),
      coberturaCostoPorcentaje:
        Number(
          ventas
            .coberturaCostoPorcentaje || 0
        ),
      utilidadBrutaConfiable:
        coberturaCompleta
          ? Number(
              ventas
                .utilidadBrutaConfiable || 0
            )
          : null,
      gastosRegistrados:
        Number(
          gastos
            .montoGastosRegistrados || 0
        ),
      utilidadOperacionalConfiable:
        utilidadOperacional,
      estadoConfiabilidad:
        coberturaCompleta
          ? "COMPLETO"
          : "PARCIAL",
      cerradoAt:
        new Date(),
      createdBy:
        usuarioObjectId,
      deletedAt: null
    });

  eventBus.emit(
    "CIERRE_FINANCIERO_MENSUAL_CREADO",
    {
      empresaId:
        empresaObjectId,
      cierreId:
        cierre._id,
      periodo:
        cierre.periodo,
      estadoConfiabilidad:
        cierre.estadoConfiabilidad,
      utilidadOperacionalConfiable:
        cierre.utilidadOperacionalConfiable,
      createdBy:
        usuarioObjectId
    }
  );

  return cierre.toObject();
}

async function totalReservasActivas(
  empresaId
) {
  const rows =
    await ReservaCaja.aggregate([
      {
        $match: {
          empresaId:
            objectId(
              empresaId,
              "empresaId"
            ),
          estado:
            "ACTIVA",
          deletedAt:
            null
        }
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $max: [
                0,
                {
                  $subtract: [
                    "$monto",
                    {
                      $ifNull: [
                        "$montoConsumido",
                        0
                      ]
                    }
                  ]
                }
              ]
            }
          }
        }
      }
    ]);

  return Number(
    rows[0]?.total || 0
  );
}

async function calcularDistribucionDueno({
  empresaId,
  cierreId
}) {
  const empresaObjectId =
    objectId(
      empresaId,
      "empresaId"
    );

  const cierre =
    await CierreFinancieroMensual.findOne({
      _id:
        objectId(
          cierreId,
          "cierreId"
        ),
      empresaId:
        empresaObjectId,
      deletedAt: null
    }).lean();

  if (!cierre) {
    throw serviceError(
      404,
      "Cierre financiero no encontrado"
    );
  }

  const politica =
    await obtenerPoliticaDistribucionDueno(
      empresaObjectId
    );

  if (!politica.habilitada) {
    return {
      estado:
        "POLITICA_INACTIVA",
      montoPropuesto: 0,
      cierre,
      politica
    };
  }

  if (
    cierre.estadoConfiabilidad !==
    "COMPLETO"
  ) {
    return {
      estado:
        "CIERRE_NO_CONFIABLE",
      montoPropuesto: 0,
      cierre,
      politica
    };
  }

  const utilidad =
    Number(
      cierre
        .utilidadOperacionalConfiable || 0
    );

  if (utilidad <= 0) {
    return {
      estado:
        "SIN_UTILIDAD_DISTRIBUIBLE",
      montoPropuesto: 0,
      cierre,
      politica
    };
  }

  const [
    proyeccion,
    reservasActivas
  ] = await Promise.all([
    construirProyeccionTesoreria({
      empresaId:
        empresaObjectId
    }),
    totalReservasActivas(
      empresaObjectId
    )
  ]);

  if (
    proyeccion
      .estadoTesoreria !==
      "COMPLETO"
  ) {
    return {
      estado:
        "TESORERIA_NO_CONFIABLE",
      montoPropuesto: 0,
      cierre,
      politica,
      proyeccion
    };
  }

  if (
    proyeccion
      .confiabilidad !==
      "COMPLETO"
  ) {
    return {
      estado:
        "HORIZONTE_30D_INCOMPLETO",
      montoPropuesto: 0,
      cierre,
      politica,
      proyeccion
    };
  }

  const saldoActual =
    Number(
      proyeccion
        .saldoActual || 0
    );

  const obligaciones30d =
    Number(
      proyeccion
        .obligaciones
        ?.proximos30d
        ?.monto || 0
    );

  const cajaLibre =
    Math.max(
      0,
      saldoActual -
      obligaciones30d -
      reservasActivas -
      politica
        .reserva_minima_caja
    );

  const derechoTeorico =
    Math.max(
      0,
      utilidad *
      (
        politica
          .porcentaje_utilidad /
        100
      )
    );

  const montoPropuesto =
    Math.min(
      derechoTeorico,
      cajaLibre
    );

  return {
    estado:
      montoPropuesto > 0
        ? "DISTRIBUIBLE"
        : "SIN_CAJA_LIBRE",
    cierre,
    politica,
    saldoActual,
    obligaciones30d,
    reservasActivas,
    reservaMinimaCaja:
      politica
        .reserva_minima_caja,
    cajaLibreDistribuible:
      cajaLibre,
    utilidadOperacionalConfiable:
      utilidad,
    derechoTeoricoDueno:
      derechoTeorico,
    montoPropuesto
  };
}

async function crearPropuestaReservaDueno({
  empresaId,
  cierreId,
  createdBy
}) {
  const calculo =
    await calcularDistribucionDueno({
      empresaId,
      cierreId
    });

  if (
    calculo.estado !==
      "DISTRIBUIBLE" ||
    calculo.montoPropuesto <= 0
  ) {
    throw serviceError(
      409,
      `No existe utilidad distribuible: ${calculo.estado}`
    );
  }

  const existente =
    await ReservaCaja.findOne({
      empresaId:
        objectId(
          empresaId,
          "empresaId"
        ),
      categoria:
        "UTILIDAD_DUENO",
      origenTipo:
        "CIERRE_MENSUAL",
      origenId:
        objectId(
          cierreId,
          "cierreId"
        ),
      estado: {
        $in: [
          "PROPUESTA",
          "ACTIVA"
        ]
      },
      deletedAt: null
    }).lean();

  if (existente) {
    return {
      reserva:
        existente,
      calculo
    };
  }

  const reserva =
    await ReservaCaja.create({
      empresaId:
        objectId(
          empresaId,
          "empresaId"
        ),
      sedeId: null,
      categoria:
        "UTILIDAD_DUENO",
      monto:
        calculo.montoPropuesto,
      estado:
        "PROPUESTA",
      origenTipo:
        "CIERRE_MENSUAL",
      origenId:
        objectId(
          cierreId,
          "cierreId"
        ),
      concepto:
        `Utilidad del dueño - cierre ${calculo.cierre.periodo}`,
      metadata: {
        utilidadOperacionalConfiable:
          calculo
            .utilidadOperacionalConfiable,
        porcentajeUtilidad:
          calculo
            .politica
            .porcentaje_utilidad,
        derechoTeoricoDueno:
          calculo
            .derechoTeoricoDueno,
        cajaLibreDistribuible:
          calculo
            .cajaLibreDistribuible
      },
      createdBy:
        objectId(
          createdBy,
          "createdBy"
        ),
      deletedAt: null
    });

  eventBus.emit(
    "RESERVA_UTILIDAD_DUENO_PROPUESTA",
    {
      empresaId:
        reserva.empresaId,
      reservaId:
        reserva._id,
      cierreId:
        reserva.origenId,
      monto:
        reserva.monto,
      createdBy:
        reserva.createdBy
    }
  );

  return {
    reserva:
      reserva.toObject(),
    calculo
  };
}

async function aprobarReservaDueno({
  empresaId,
  reservaId,
  approvedBy
}) {
  const empresaObjectId =
    objectId(
      empresaId,
      "empresaId"
    );

  const reserva =
    await ReservaCaja.findOne({
      _id:
        objectId(
          reservaId,
          "reservaId"
        ),
      empresaId:
        empresaObjectId,
      categoria:
        "UTILIDAD_DUENO",
      estado:
        "PROPUESTA",
      deletedAt: null
    });

  if (!reserva) {
    throw serviceError(
      404,
      "Reserva propuesta no encontrada"
    );
  }

  const calculo =
    await calcularDistribucionDueno({
      empresaId:
        empresaObjectId,
      cierreId:
        reserva.origenId
    });

  if (
    calculo.estado !==
      "DISTRIBUIBLE" ||
    calculo.montoPropuesto <
      Number(
        reserva.monto
      )
  ) {
    throw serviceError(
      409,
      "La caja libre cambió y ya no soporta esta reserva. Recalcula la propuesta."
    );
  }

  reserva.estado =
    "ACTIVA";
  reserva.approvedBy =
    objectId(
      approvedBy,
      "approvedBy"
    );
  reserva.approvedAt =
    new Date();

  await reserva.save();

  eventBus.emit(
    "RESERVA_UTILIDAD_DUENO_APROBADA",
    {
      empresaId:
        reserva.empresaId,
      reservaId:
        reserva._id,
      monto:
        reserva.monto,
      approvedBy:
        reserva.approvedBy
    }
  );

  return reserva.toObject();
}

async function listarReservas({
  empresaId
}) {
  return ReservaCaja.find({
    empresaId:
      objectId(
        empresaId,
        "empresaId"
      ),
    deletedAt: null
  })
    .sort({
      createdAt: -1
    })
    .lean();
}

module.exports = {
  limitesPeriodo,
  obtenerPoliticaDistribucionDueno,
  actualizarPoliticaDistribucionDueno,
  cerrarPeriodoMensual,
  calcularDistribucionDueno,
  crearPropuestaReservaDueno,
  aprobarReservaDueno,
  listarReservas,
  totalReservasActivas
};
