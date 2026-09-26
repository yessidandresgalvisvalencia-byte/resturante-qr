"use strict";

const mongoose = require("mongoose");

const ReservaCaja = require("./models/ReservaCaja");
const RetiroDueno = require("./models/RetiroDueno");
const MovimientoCaja = require("./models/MovimientoCaja");
const CuentaTesoreria = require("./models/CuentaTesoreria");
const {
  calcularSaldoCuenta
} = require("./tesoreria.service");
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

function saldoReserva(reserva) {
  return Math.max(
    0,
    Number(reserva?.monto || 0) -
    Number(reserva?.montoConsumido || 0)
  );
}

async function evaluarRetiroSeguro({
  empresaId,
  reservaId
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
        "ACTIVA",
      deletedAt:
        null
    }).lean();

  if (!reserva) {
    throw serviceError(
      404,
      "Reserva activa del dueño no encontrada"
    );
  }

  const restante =
    saldoReserva(
      reserva
    );

  if (restante <= 0) {
    return {
      estado:
        "RESERVA_CONSUMIDA",
      puedeRetirarHoy:
        false,
      montoMaximoHoy:
        0,
      reservaRestante:
        0,
      cuentasElegibles:
        [],
      motivo:
        "La reserva ya fue consumida."
    };
  }

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId:
        empresaObjectId
    });

  if (
    proyeccion.estadoTesoreria !==
    "COMPLETO"
  ) {
    return {
      estado:
        "TESORERIA_NO_CONFIABLE",
      puedeRetirarHoy:
        false,
      montoMaximoHoy:
        0,
      reservaRestante:
        restante,
      cuentasElegibles:
        [],
      motivo:
        "Tesoreria no es completamente verificable. No se autoriza retiro."
    };
  }

  const saldoActual =
    Number(
      proyeccion.saldoActual || 0
    );

  const reservasTotales =
    Number(
      proyeccion
        .reservasActivas
        ?.total || 0
    );

  const respaldoFaltante =
    Math.max(
      0,
      reservasTotales -
      saldoActual
    );

  const cuentas =
    Array.isArray(
      proyeccion
        ?.obligacionesRegistradas
    )
      ? []
      : [];

  const cuentasTesoreria =
    await CuentaTesoreria.find({
      empresaId:
        empresaObjectId,
      estado:
        "activa",
      deletedAt:
        null
    })
      .sort({
        esPrincipal:
          -1,
        nombre:
          1
      })
      .lean();

  const cuentasConSaldo =
    [];

  for (
    const cuenta of
    cuentasTesoreria
  ) {
    const saldo =
      await calcularSaldoCuenta(
        cuenta
      );

    cuentasConSaldo.push({
      cuentaId:
        cuenta._id,
      nombre:
        cuenta.nombre,
      tipo:
        cuenta.tipo,
      saldoDisponible:
        Number(
          saldo.saldoDisponible || 0
        )
    });
  }

  if (respaldoFaltante > 0) {
    return {
      estado:
        "RESERVAS_NO_RESPALDADAS",
      puedeRetirarHoy:
        false,
      montoMaximoHoy:
        0,
      reservaRestante:
        restante,
      saldoTesoreria:
        saldoActual,
      reservasActivas:
        reservasTotales,
      respaldoFaltante,
      cuentasElegibles:
        cuentasConSaldo,
      motivo:
        `Las reservas activas superan el saldo verificable. Faltan ${respaldoFaltante} para volver a respaldarlas completamente.`
    };
  }

  const cuentasElegibles =
    cuentasConSaldo
      .filter(
        (cuenta) =>
          cuenta.saldoDisponible > 0
      )
      .map((cuenta) => ({
        ...cuenta,
        montoMaximoDesdeCuenta:
          Math.min(
            restante,
            cuenta.saldoDisponible
          )
      }));

  const maxCuenta =
    cuentasElegibles.reduce(
      (maximo, cuenta) =>
        Math.max(
          maximo,
          Number(
            cuenta.montoMaximoDesdeCuenta || 0
          )
        ),
      0
    );

  const montoMaximoHoy =
    Math.min(
      restante,
      maxCuenta
    );

  if (montoMaximoHoy <= 0) {
    return {
      estado:
        "SIN_CUENTA_CON_SALDO",
      puedeRetirarHoy:
        false,
      montoMaximoHoy:
        0,
      reservaRestante:
        restante,
      saldoTesoreria:
        saldoActual,
      reservasActivas:
        reservasTotales,
      respaldoFaltante:
        0,
      cuentasElegibles,
      motivo:
        "La reserva está respaldada globalmente, pero ninguna cuenta activa tiene saldo disponible para materializar el retiro."
    };
  }

  return {
    estado:
      montoMaximoHoy >= restante
        ? "SEGURO_HOY"
        : "PARCIAL_HOY",
    puedeRetirarHoy:
      true,
    montoMaximoHoy,
    reservaRestante:
      restante,
    saldoTesoreria:
      saldoActual,
    reservasActivas:
      reservasTotales,
    respaldoFaltante:
      0,
    cajaOperativaLibre:
      Number(
        proyeccion
          .saldoLibreOperativo || 0
      ),
    cuentasElegibles,
    motivo:
      montoMaximoHoy >= restante
        ? "La reserva está completamente respaldada y puede retirarse hoy sin reducir la caja operativa libre."
        : "Puede retirarse parcialmente hoy. Para retirar todo, concentra el saldo mediante transferencia interna o espera una entrada confirmada."
  };
}

async function registrarRetiroDueno({
  empresaId,
  reservaId,
  cuentaTesoreriaId,
  monto,
  concepto = "Retiro de utilidad del dueño",
  createdBy
}) {
  const montoNumero =
    Number(
      monto
    );

  if (
    !Number.isFinite(
      montoNumero
    ) ||
    montoNumero <= 0
  ) {
    throw serviceError(
      400,
      "Monto de retiro invalido"
    );
  }

  const empresaObjectId =
    objectId(
      empresaId,
      "empresaId"
    );

  const reservaObjectId =
    objectId(
      reservaId,
      "reservaId"
    );

  const cuentaObjectId =
    objectId(
      cuentaTesoreriaId,
      "cuentaTesoreriaId"
    );

  const usuarioObjectId =
    objectId(
      createdBy,
      "createdBy"
    );

  const diagnostico =
    await evaluarRetiroSeguro({
      empresaId:
        empresaObjectId,
      reservaId:
        reservaObjectId
    });

  if (
    !diagnostico
      .puedeRetirarHoy
  ) {
    throw serviceError(
      409,
      diagnostico.motivo
    );
  }

  if (
    montoNumero >
    diagnostico
      .reservaRestante
  ) {
    throw serviceError(
      409,
      "El retiro supera el saldo restante de la reserva."
    );
  }

  const cuentaDiagnosticada =
    diagnostico
      .cuentasElegibles
      .find(
        (item) =>
          String(
            item.cuentaId
          ) ===
          String(
            cuentaObjectId
          )
      );

  if (
    !cuentaDiagnosticada ||
    montoNumero >
      Number(
        cuentaDiagnosticada
          .montoMaximoDesdeCuenta || 0
      )
  ) {
    throw serviceError(
      409,
      "La cuenta seleccionada no tiene saldo suficiente para este retiro."
    );
  }

  const session =
    await mongoose.startSession();

  let retiroCreado =
    null;

  try {
    await session.withTransaction(
      async () => {
        const reserva =
          await ReservaCaja.findOne({
            _id:
              reservaObjectId,
            empresaId:
              empresaObjectId,
            categoria:
              "UTILIDAD_DUENO",
            estado:
              "ACTIVA",
            deletedAt:
              null
          })
            .session(
              session
            );

        if (!reserva) {
          throw serviceError(
            409,
            "La reserva ya no está activa."
          );
        }

        const restanteActual =
          saldoReserva(
            reserva
          );

        if (
          montoNumero >
          restanteActual
        ) {
          throw serviceError(
            409,
            "El retiro supera el saldo restante de la reserva."
          );
        }

        const cuenta =
          await CuentaTesoreria.findOne({
            _id:
              cuentaObjectId,
            empresaId:
              empresaObjectId,
            estado:
              "activa",
            deletedAt:
              null
          })
            .session(
              session
            );

        if (!cuenta) {
          throw serviceError(
            404,
            "Cuenta de tesoreria no encontrada."
          );
        }

        await CuentaTesoreria.updateOne(
          {
            _id:
              cuenta._id
          },
          {
            $inc: {
              versionSaldo:
                1
            }
          },
          {
            session
          }
        );

        const saldoCuenta =
          await calcularSaldoCuenta(
            cuenta,
            session
          );

        if (
          saldoCuenta
            .saldoDisponible <
          montoNumero
        ) {
          throw serviceError(
            409,
            "El saldo de la cuenta cambió y ya no soporta el retiro."
          );
        }

        const retiroId =
          new mongoose.Types.ObjectId();

        const fecha =
          new Date();

        const [movimiento] =
          await MovimientoCaja.create(
            [
              {
                empresaId:
                  empresaObjectId,
                sedeId:
                  cuenta.sedeId ||
                  null,
                cuentaTesoreriaId:
                  cuenta._id,
                estadoAsignacionCuenta:
                  "ASIGNADA",
                direccion:
                  "SALIDA",
                monto:
                  montoNumero,
                moneda:
                  "COP",
                origenTipo:
                  "RETIRO_DUENO",
                origenId:
                  retiroId,
                tipoAsiento:
                  "CONFIRMACION",
                movimientoOriginalId:
                  null,
                concepto:
                  String(
                    concepto ||
                    "Retiro de utilidad del dueño"
                  )
                    .trim()
                    .slice(
                      0,
                      500
                    ),
                metodoPago:
                  "retiro_dueno",
                claveIdempotencia:
                  `RETIRO_DUENO:${retiroId}:CONFIRMACION`,
                referenciaEconomica:
                  `RETIRO_DUENO:${reserva._id}`,
                confirmadoAt:
                  fecha,
                metadata: {
                  reservaCajaId:
                    String(
                      reserva._id
                    )
                },
                createdBy:
                  usuarioObjectId,
                deletedAt:
                  null
              }
            ],
            {
              session
            }
          );

        const [retiro] =
          await RetiroDueno.create(
            [
              {
                _id:
                  retiroId,
                empresaId:
                  empresaObjectId,
                sedeId:
                  cuenta.sedeId ||
                  null,
                reservaCajaId:
                  reserva._id,
                cuentaTesoreriaId:
                  cuenta._id,
                monto:
                  montoNumero,
                fecha,
                concepto:
                  String(
                    concepto ||
                    "Retiro de utilidad del dueño"
                  )
                    .trim()
                    .slice(
                      0,
                      300
                    ),
                movimientoCajaId:
                  movimiento._id,
                createdBy:
                  usuarioObjectId,
                deletedAt:
                  null
              }
            ],
            {
              session
            }
          );

        reserva.montoConsumido =
          Number(
            reserva
              .montoConsumido || 0
          ) +
          montoNumero;

        const restanteDespues =
          Math.max(
            0,
            Number(
              reserva.monto || 0
            ) -
            Number(
              reserva
                .montoConsumido || 0
            )
          );

        if (
          restanteDespues <= 0.000001
        ) {
          reserva.estado =
            "CONSUMIDA";
          reserva.consumidaAt =
            fecha;
        }

        await reserva.save({
          session
        });

        retiroCreado = {
          retiro:
            retiro.toObject(),
          movimiento:
            movimiento.toObject(),
          reserva: {
            _id:
              reserva._id,
            estado:
              reserva.estado,
            monto:
              reserva.monto,
            montoConsumido:
              reserva.montoConsumido,
            saldoRestante:
              restanteDespues
          }
        };
      }
    );
  } finally {
    await session.endSession();
  }

  eventBus.emit(
    "RETIRO_DUENO_REGISTRADO",
    {
      empresaId:
        empresaObjectId,
      retiroId:
        retiroCreado
          .retiro
          ._id,
      reservaId:
        reservaObjectId,
      cuentaTesoreriaId:
        cuentaObjectId,
      monto:
        montoNumero,
      fecha:
        retiroCreado
          .retiro
          .fecha,
      createdBy:
        usuarioObjectId
    }
  );

  return retiroCreado;
}

async function listarRetirosDueno({
  empresaId
}) {
  return RetiroDueno.find({
    empresaId:
      objectId(
        empresaId,
        "empresaId"
      ),
    deletedAt:
      null
  })
    .sort({
      fecha:
        -1
    })
    .lean();
}

module.exports = {
  saldoReserva,
  evaluarRetiroSeguro,
  registrarRetiroDueno,
  listarRetirosDueno
};
