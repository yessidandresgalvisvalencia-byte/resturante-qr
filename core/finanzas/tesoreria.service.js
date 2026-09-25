"use strict";

const mongoose = require("mongoose");

const CuentaTesoreria = require("./models/CuentaTesoreria");
const TransferenciaTesoreria = require("./models/TransferenciaTesoreria");
const MovimientoCaja = require("./models/MovimientoCaja");
const eventBus = require("../eventos/eventBus");

function serviceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function objectId(valor, nombre = "id") {
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

function normalizarMetodoPago(valor) {
  const texto = String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!texto) return "otro";

  if (
    texto.includes("efectivo") ||
    texto.includes("cash")
  ) return "efectivo";

  if (
    texto.includes("transfer") ||
    texto.includes("banco")
  ) return "transferencia";

  if (
    texto.includes("tarjeta") ||
    texto.includes("datafono") ||
    texto.includes("dataphone")
  ) return "tarjeta";

  if (texto.includes("nequi")) {
    return "nequi";
  }

  if (texto.includes("daviplata")) {
    return "daviplata";
  }

  return "otro";
}

async function resolverCuentaPorMetodo({
  empresaId,
  sedeId = null,
  metodoPago
}) {
  const metodo =
    normalizarMetodoPago(
      metodoPago
    );

  const empresaObjectId =
    objectId(
      empresaId,
      "empresaId"
    );

  const cuentas =
    await CuentaTesoreria.find({
      empresaId:
        empresaObjectId,
      estado: "activa",
      deletedAt: null,
      metodosPagoAsociados:
        metodo
    })
      .select("_id sedeId")
      .lean();

  if (!cuentas.length) {
    return null;
  }

  if (sedeId) {
    const sedeTexto =
      String(sedeId);

    const exactas =
      cuentas.filter(
        (cuenta) =>
          cuenta.sedeId &&
          String(
            cuenta.sedeId
          ) === sedeTexto
      );

    if (exactas.length === 1) {
      return exactas[0]._id;
    }

    if (exactas.length > 1) {
      return null;
    }
  }

  const globales =
    cuentas.filter(
      (cuenta) =>
        !cuenta.sedeId
    );

  return globales.length === 1
    ? globales[0]._id
    : null;
}

function pipelineConfirmacionesActivas({
  empresaId,
  cuentaTesoreriaId = null,
  sedeId = null,
  desde = null
}) {
  const match = {
    empresaId:
      objectId(
        empresaId,
        "empresaId"
      ),
    tipoAsiento:
      "CONFIRMACION",
    deletedAt: null
  };

  if (cuentaTesoreriaId) {
    match.cuentaTesoreriaId =
      objectId(
        cuentaTesoreriaId,
        "cuentaTesoreriaId"
      );
  }

  if (sedeId) {
    match.sedeId =
      objectId(
        sedeId,
        "sedeId"
      );
  }

  if (desde) {
    match.confirmadoAt = {
      $gte: desde
    };
  }

  return [
    { $match: match },
    {
      $lookup: {
        from:
          "movimientos_caja",
        let: {
          confirmacionId:
            "$_id",
          empresa:
            "$empresaId"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: [
                      "$empresaId",
                      "$$empresa"
                    ]
                  },
                  {
                    $eq: [
                      "$tipoAsiento",
                      "REVERSION"
                    ]
                  },
                  {
                    $eq: [
                      "$movimientoOriginalId",
                      "$$confirmacionId"
                    ]
                  },
                  {
                    $eq: [
                      "$deletedAt",
                      null
                    ]
                  }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "reversiones"
      }
    },
    {
      $match: {
        "reversiones.0": {
          $exists: false
        }
      }
    }
  ];
}

async function calcularSaldoCuenta(
  cuenta,
  session = null
) {
  const pipeline = [
    ...pipelineConfirmacionesActivas({
      empresaId:
        cuenta.empresaId,
      cuentaTesoreriaId:
        cuenta._id,
      desde:
        cuenta.saldoInicialAt
    }),
    {
      $group: {
        _id: null,
        entradas: {
          $sum: {
            $cond: [
              {
                $eq: [
                  "$direccion",
                  "ENTRADA"
                ]
              },
              "$monto",
              0
            ]
          }
        },
        salidas: {
          $sum: {
            $cond: [
              {
                $eq: [
                  "$direccion",
                  "SALIDA"
                ]
              },
              "$monto",
              0
            ]
          }
        }
      }
    }
  ];

  let aggregate =
    MovimientoCaja.aggregate(
      pipeline
    );

  if (session) {
    aggregate =
      aggregate.session(
        session
      );
  }

  const [row] =
    await aggregate;

  const entradas =
    Number(
      row?.entradas || 0
    );

  const salidas =
    Number(
      row?.salidas || 0
    );

  return {
    saldoInicial:
      Number(
        cuenta.saldoInicial || 0
      ),
    entradas,
    salidas,
    saldoDisponible:
      Number(
        cuenta.saldoInicial || 0
      ) +
      entradas -
      salidas
  };
}

async function crearCuenta({
  empresaId,
  sedeId = null,
  nombre,
  tipo,
  saldoInicial = 0,
  saldoInicialAt = new Date(),
  metodosPagoAsociados = [],
  esPrincipal = false,
  permiteSaldoNegativo = false,
  createdBy
}) {
  const empresaObjectId =
    objectId(
      empresaId,
      "empresaId"
    );

  const sedeObjectId =
    sedeId
      ? objectId(
          sedeId,
          "sedeId"
        )
      : null;

  const usuarioObjectId =
    objectId(
      createdBy,
      "createdBy"
    );

  const fecha =
    new Date(
      saldoInicialAt
    );

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    throw serviceError(
      400,
      "saldoInicialAt invalido"
    );
  }

  const metodos = [
    ...new Set(
      (metodosPagoAsociados || [])
        .map(
          normalizarMetodoPago
        )
    )
  ];

  const cuenta =
    await CuentaTesoreria.create({
      empresaId:
        empresaObjectId,
      sedeId:
        sedeObjectId,
      nombre:
        String(nombre || "")
          .trim(),
      tipo,
      moneda: "COP",
      saldoInicial:
        Number(saldoInicial || 0),
      saldoInicialAt:
        fecha,
      metodosPagoAsociados:
        metodos,
      esPrincipal:
        Boolean(esPrincipal),
      permiteSaldoNegativo:
        Boolean(
          permiteSaldoNegativo
        ),
      createdBy:
        usuarioObjectId,
      deletedAt: null
    });

  eventBus.emit(
    "TESORERIA_CUENTA_CREADA",
    {
      empresaId:
        cuenta.empresaId,
      sedeId:
        cuenta.sedeId,
      cuentaTesoreriaId:
        cuenta._id,
      saldoInicial:
        cuenta.saldoInicial,
      saldoInicialAt:
        cuenta.saldoInicialAt
    }
  );

  return cuenta.toObject();
}

async function listarCuentas({
  empresaId,
  sedeId = null
}) {
  const filtro = {
    empresaId:
      objectId(
        empresaId,
        "empresaId"
      ),
    deletedAt: null
  };

  if (sedeId) {
    filtro.sedeId =
      objectId(
        sedeId,
        "sedeId"
      );
  }

  const cuentas =
    await CuentaTesoreria.find(
      filtro
    )
      .sort({
        esPrincipal: -1,
        nombre: 1
      })
      .lean();

  return Promise.all(
    cuentas.map(
      async (cuenta) => ({
        ...cuenta,
        saldo:
          await calcularSaldoCuenta(
            cuenta
          )
      })
    )
  );
}

async function resumenNoAsignados({
  empresaId,
  sedeId = null,
  desde
}) {
  const match = {
    empresaId:
      objectId(
        empresaId,
        "empresaId"
      ),
    cuentaTesoreriaId: null,
    estadoAsignacionCuenta:
      "SIN_ASIGNAR",
    origenTipo: {
      $in: [
        "VENTA",
        "COMPRA",
        "GASTO"
      ]
    },
    tipoAsiento:
      "CONFIRMACION",
    deletedAt: null,
    confirmadoAt: {
      $gte: desde
    }
  };

  if (sedeId) {
    match.sedeId =
      objectId(
        sedeId,
        "sedeId"
      );
  }

  const rows =
    await MovimientoCaja.aggregate([
      { $match: match },
      {
        $lookup: {
          from:
            "movimientos_caja",
          let: {
            confirmacionId:
              "$_id",
            empresa:
              "$empresaId"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        "$empresaId",
                        "$$empresa"
                      ]
                    },
                    {
                      $eq: [
                        "$tipoAsiento",
                        "REVERSION"
                      ]
                    },
                    {
                      $eq: [
                        "$movimientoOriginalId",
                        "$$confirmacionId"
                      ]
                    },
                    {
                      $eq: [
                        "$deletedAt",
                        null
                      ]
                    }
                  ]
                }
              }
            },
            {
              $limit: 1
            }
          ],
          as: "reversiones"
        }
      },
      {
        $match: {
          "reversiones.0": {
            $exists: false
          }
        }
      },
      {
        $group: {
          _id: "$direccion",
          cantidad: {
            $sum: 1
          },
          monto: {
            $sum: "$monto"
          }
        }
      }
    ]);

  const resultado = {
    entradas: {
      cantidad: 0,
      monto: 0
    },
    salidas: {
      cantidad: 0,
      monto: 0
    }
  };

  for (const row of rows) {
    if (
      row._id ===
      "ENTRADA"
    ) {
      resultado.entradas = {
        cantidad:
          Number(
            row.cantidad || 0
          ),
        monto:
          Number(
            row.monto || 0
          )
      };
    }

    if (
      row._id ===
      "SALIDA"
    ) {
      resultado.salidas = {
        cantidad:
          Number(
            row.cantidad || 0
          ),
        monto:
          Number(
            row.monto || 0
          )
      };
    }
  }

  return resultado;
}

async function obtenerResumenTesoreria({
  empresaId,
  sedeId = null
}) {
  const cuentas =
    await listarCuentas({
      empresaId,
      sedeId
    });

  if (!cuentas.length) {
    return {
      estadoConfiabilidad:
        "SIN_CONFIGURAR",
      saldoDisponible: null,
      cuentas: [],
      movimientosSinAsignar: {
        entradas: {
          cantidad: 0,
          monto: 0
        },
        salidas: {
          cantidad: 0,
          monto: 0
        }
      },
      advertencia:
        "No existen cuentas de tesoreria configuradas."
    };
  }

  const desde =
    cuentas.reduce(
      (minimo, cuenta) => {
        const fecha =
          new Date(
            cuenta.saldoInicialAt
          );

        return !minimo ||
          fecha < minimo
          ? fecha
          : minimo;
      },
      null
    );

  const sinAsignar =
    await resumenNoAsignados({
      empresaId,
      sedeId,
      desde
    });

  const totalSinAsignar =
    sinAsignar.entradas.cantidad +
    sinAsignar.salidas.cantidad;

  const saldoDisponible =
    cuentas.reduce(
      (total, cuenta) =>
        total +
        Number(
          cuenta.saldo
            ?.saldoDisponible || 0
        ),
      0
    );

  return {
    estadoConfiabilidad:
      totalSinAsignar > 0
        ? "PARCIAL"
        : "COMPLETO",
    saldoDisponible,
    cuentas,
    movimientosSinAsignar:
      sinAsignar,
    advertencia:
      totalSinAsignar > 0
        ? "Existen movimientos confirmados posteriores al saldo inicial que aun no tienen cuenta asignada."
        : null
  };
}

async function obtenerCuentaAutorizada({
  cuentaId,
  empresaId,
  sedeScopeId = null,
  session = null
}) {
  const filtro = {
    _id:
      objectId(
        cuentaId,
        "cuentaId"
      ),
    empresaId:
      objectId(
        empresaId,
        "empresaId"
      ),
    estado: "activa",
    deletedAt: null
  };

  if (sedeScopeId) {
    filtro.sedeId =
      objectId(
        sedeScopeId,
        "sedeId"
      );
  }

  let query =
    CuentaTesoreria.findOne(
      filtro
    );

  if (session) {
    query =
      query.session(
        session
      );
  }

  const cuenta =
    await query;

  if (!cuenta) {
    throw serviceError(
      404,
      "Cuenta de tesoreria no encontrada o fuera del alcance autorizado"
    );
  }

  return cuenta;
}

async function transferir({
  empresaId,
  sedeScopeId = null,
  cuentaOrigenId,
  cuentaDestinoId,
  monto,
  concepto = "Transferencia interna",
  createdBy
}) {
  if (
    String(cuentaOrigenId) ===
    String(cuentaDestinoId)
  ) {
    throw serviceError(
      400,
      "La cuenta origen y destino deben ser diferentes"
    );
  }

  const montoNumero =
    Number(monto);

  if (
    !Number.isFinite(
      montoNumero
    ) ||
    montoNumero <= 0
  ) {
    throw serviceError(
      400,
      "Monto de transferencia invalido"
    );
  }

  const usuarioObjectId =
    objectId(
      createdBy,
      "createdBy"
    );

  const session =
    await mongoose.startSession();

  let transferenciaCreada = null;

  try {
    await session.withTransaction(
      async () => {
        const origen =
          await obtenerCuentaAutorizada({
            cuentaId:
              cuentaOrigenId,
            empresaId,
            sedeScopeId,
            session
          });

        const destino =
          await obtenerCuentaAutorizada({
            cuentaId:
              cuentaDestinoId,
            empresaId,
            sedeScopeId,
            session
          });

        await CuentaTesoreria.updateOne(
          {
            _id: origen._id
          },
          {
            $inc: {
              versionSaldo: 1
            }
          },
          { session }
        );

        const saldoOrigen =
          await calcularSaldoCuenta(
            origen,
            session
          );

        if (
          !origen.permiteSaldoNegativo &&
          saldoOrigen.saldoDisponible <
            montoNumero
        ) {
          throw serviceError(
            409,
            "Saldo insuficiente en la cuenta origen"
          );
        }

        const [transferencia] =
          await TransferenciaTesoreria.create(
            [
              {
                empresaId:
                  origen.empresaId,
                sedeId:
                  origen.sedeId || null,
                cuentaOrigenId:
                  origen._id,
                cuentaDestinoId:
                  destino._id,
                monto:
                  montoNumero,
                concepto:
                  String(
                    concepto ||
                    "Transferencia interna"
                  )
                    .trim()
                    .slice(0, 500),
                fecha:
                  new Date(),
                estado:
                  "completada",
                createdBy:
                  usuarioObjectId,
                deletedAt: null
              }
            ],
            { session }
          );

        const base = {
          empresaId:
            origen.empresaId,
          moneda: "COP",
          origenTipo:
            "TRANSFERENCIA",
          origenId:
            transferencia._id,
          tipoAsiento:
            "CONFIRMACION",
          movimientoOriginalId:
            null,
          referenciaEconomica:
            `TRANSFERENCIA:${transferencia._id}`,
          confirmadoAt:
            transferencia.fecha,
          createdBy:
            usuarioObjectId,
          deletedAt: null,
          estadoAsignacionCuenta:
            "TRANSFERENCIA",
          metodoPago:
            "transferencia",
          metadata: {
            transferenciaId:
              String(
                transferencia._id
              )
          }
        };

        await MovimientoCaja.insertMany(
          [
            {
              ...base,
              sedeId:
                origen.sedeId || null,
              cuentaTesoreriaId:
                origen._id,
              direccion:
                "SALIDA",
              monto:
                montoNumero,
              concepto:
                transferencia.concepto,
              claveIdempotencia:
                `TRANSFERENCIA:${transferencia._id}:SALIDA`
            },
            {
              ...base,
              sedeId:
                destino.sedeId || null,
              cuentaTesoreriaId:
                destino._id,
              direccion:
                "ENTRADA",
              monto:
                montoNumero,
              concepto:
                transferencia.concepto,
              claveIdempotencia:
                `TRANSFERENCIA:${transferencia._id}:ENTRADA`
            }
          ],
          { session }
        );

        transferenciaCreada =
          transferencia.toObject();
      }
    );
  } finally {
    await session.endSession();
  }

  eventBus.emit(
    "TESORERIA_TRANSFERENCIA_COMPLETADA",
    {
      empresaId:
        transferenciaCreada.empresaId,
      sedeId:
        transferenciaCreada.sedeId,
      transferenciaId:
        transferenciaCreada._id,
      cuentaOrigenId:
        transferenciaCreada.cuentaOrigenId,
      cuentaDestinoId:
        transferenciaCreada.cuentaDestinoId,
      monto:
        transferenciaCreada.monto,
      fecha:
        transferenciaCreada.fecha
    }
  );

  return transferenciaCreada;
}

module.exports = {
  normalizarMetodoPago,
  resolverCuentaPorMetodo,
  calcularSaldoCuenta,
  crearCuenta,
  listarCuentas,
  obtenerResumenTesoreria,
  transferir
};
