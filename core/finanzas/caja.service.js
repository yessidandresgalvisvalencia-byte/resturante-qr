"use strict";

const mongoose = require("mongoose");

const Venta = require("../../models/Venta");
const Compra = require("../../models/Compra");
const Gasto = require("../../models/Gasto");
const MovimientoCaja = require("./models/MovimientoCaja");
const eventBus = require("../eventos/eventBus");

const TIPOS_SOPORTADOS = Object.freeze([
  "VENTA_COMPLETADA",
  "GASTO_REGISTRADO",
  "GASTO_PAGO_ACTUALIZADO",
  "COMPRA_REGISTRADA",
  "COMPRA_PAGO_ACTUALIZADO"
]);

function numeroPositivo(valor) {
  const numero = Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero <= 0
  ) {
    return null;
  }

  return numero;
}

function fechaSegura(valor, fallback = new Date()) {
  const fecha = valor
    ? new Date(valor)
    : fallback;

  return Number.isNaN(fecha.getTime())
    ? fallback
    : fecha;
}

function idValido(valor) {
  return Boolean(
    valor &&
    mongoose.Types.ObjectId.isValid(valor)
  );
}

function referenciaEconomica(payload) {
  const valor =
    payload?.cajaReferencia ||
    payload?.metadata?.cajaReferencia ||
    null;

  if (!valor) return null;

  return String(valor)
    .trim()
    .slice(0, 200) || null;
}

function claveEstadoFuente({
  origenTipo,
  origenId,
  tipoAsiento,
  sourceUpdatedAt,
  occurredAt
}) {
  const marca =
    fechaSegura(
      sourceUpdatedAt,
      fechaSegura(occurredAt)
    ).toISOString();

  return [
    origenTipo,
    String(origenId),
    tipoAsiento,
    marca
  ].join(":");
}

function construirCandidatoDesdeEvento(event) {
  const eventName =
    String(event?.eventName || "");

  if (!TIPOS_SOPORTADOS.includes(eventName)) {
    return null;
  }

  const payload =
    event?.payload || {};

  if (eventName === "VENTA_COMPLETADA") {
    if (
      !idValido(payload.ventaId) ||
      !idValido(payload.empresaId)
    ) {
      return null;
    }

    const monto =
      numeroPositivo(payload.total);

    if (!monto) return null;

    return {
      accion: "CONFIRMAR",
      origenTipo: "VENTA",
      origenId: payload.ventaId,
      empresaId: payload.empresaId,
      sedeId:
        idValido(payload.sedeId)
          ? payload.sedeId
          : null,
      direccion: "ENTRADA",
      monto,
      concepto:
        String(
          payload.concepto ||
          "Venta pagada"
        ),
      metodoPago:
        String(
          payload.metodoPago || ""
        ),
      referenciaEconomica:
        referenciaEconomica(payload),
      confirmadoAt:
        fechaSegura(
          payload.fecha,
          fechaSegura(event.occurredAt)
        ),
      claveIdempotencia:
        claveEstadoFuente({
          origenTipo: "VENTA",
          origenId: payload.ventaId,
          tipoAsiento: "CONFIRMACION",
          sourceUpdatedAt:
            payload.sourceUpdatedAt,
          occurredAt:
            event.occurredAt
        }),
      metadata: {
        eventName,
        estadoPago: "pagado"
      }
    };
  }

  const esGasto =
    eventName.startsWith("GASTO_");

  const origenTipo =
    esGasto
      ? "GASTO"
      : "COMPRA";

  const origenId =
    esGasto
      ? payload.gastoId
      : payload.compraId;

  if (
    !idValido(origenId) ||
    !idValido(payload.empresaId)
  ) {
    return null;
  }

  const monto =
    numeroPositivo(
      esGasto
        ? payload.monto
        : payload.total
    );

  if (!monto) return null;

  const estadoPago =
    String(
      payload.estadoPago ||
      "desconocido"
    );

  const estadoAnterior =
    String(
      payload.estadoPagoAnterior ||
      ""
    );

  let accion = "IGNORAR";

  if (estadoPago === "pagado") {
    accion = "CONFIRMAR";
  } else if (
    estadoAnterior === "pagado"
  ) {
    accion = "REVERSAR";
  }

  if (accion === "IGNORAR") {
    return null;
  }

  const tipoAsiento =
    accion === "CONFIRMAR"
      ? "CONFIRMACION"
      : "REVERSION";

  return {
    accion,
    origenTipo,
    origenId,
    empresaId: payload.empresaId,
    sedeId:
      idValido(payload.sedeId)
        ? payload.sedeId
        : null,
    direccion: "SALIDA",
    monto,
    concepto:
      String(
        esGasto
          ? payload.concepto ||
            "Gasto pagado"
          : payload.proveedor
            ? `Compra pagada a ${payload.proveedor}`
            : "Compra pagada"
      ),
    metodoPago:
      String(
        payload.metodoPago || ""
      ),
    referenciaEconomica:
      referenciaEconomica(payload),
    confirmadoAt:
      eventName.endsWith(
        "_PAGO_ACTUALIZADO"
      )
        ? fechaSegura(
            payload.sourceUpdatedAt,
            fechaSegura(
              event.occurredAt
            )
          )
        : fechaSegura(
            payload.fecha,
            fechaSegura(
              event.occurredAt
            )
          ),
    claveIdempotencia:
      claveEstadoFuente({
        origenTipo,
        origenId,
        tipoAsiento,
        sourceUpdatedAt:
          payload.sourceUpdatedAt,
        occurredAt:
          event.occurredAt
      }),
    metadata: {
      eventName,
      estadoPago,
      estadoPagoAnterior:
        estadoAnterior || null
    }
  };
}

async function buscarConfirmacionActiva({
  empresaId,
  origenTipo,
  origenId,
  referenciaEconomica: referencia = null,
  direccion = null
}) {
  const filtroOrigen = {
    empresaId,
    origenTipo,
    origenId,
    tipoAsiento: "CONFIRMACION",
    deletedAt: null
  };

  const confirmaciones =
    await MovimientoCaja.find(
      filtroOrigen
    )
      .sort({
        confirmadoAt: -1,
        createdAt: -1
      })
      .lean();

  for (const confirmacion of confirmaciones) {
    const reversada =
      await MovimientoCaja.exists({
        empresaId,
        tipoAsiento: "REVERSION",
        movimientoOriginalId:
          confirmacion._id,
        deletedAt: null
      });

    if (!reversada) {
      return confirmacion;
    }
  }

  if (!referencia) {
    return null;
  }

  const candidatasReferencia =
    await MovimientoCaja.find({
      empresaId,
      referenciaEconomica:
        referencia,
      tipoAsiento: "CONFIRMACION",
      ...(direccion
        ? { direccion }
        : {}),
      deletedAt: null
    })
      .sort({
        confirmadoAt: -1,
        createdAt: -1
      })
      .lean();

  for (
    const confirmacion of
    candidatasReferencia
  ) {
    const reversada =
      await MovimientoCaja.exists({
        empresaId,
        tipoAsiento: "REVERSION",
        movimientoOriginalId:
          confirmacion._id,
        deletedAt: null
      });

    if (!reversada) {
      return confirmacion;
    }
  }

  return null;
}

async function crearIdempotente(documento) {
  try {
    const creado =
      await MovimientoCaja.create(
        documento
      );

    return {
      movimiento:
        creado.toObject(),
      creado: true
    };
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const existente =
      await MovimientoCaja.findOne({
        claveIdempotencia:
          documento.claveIdempotencia
      }).lean();

    if (!existente) {
      throw error;
    }

    return {
      movimiento: existente,
      creado: false
    };
  }
}

async function confirmarMovimiento(candidato) {
  const existente =
    await buscarConfirmacionActiva({
      empresaId:
        candidato.empresaId,
      origenTipo:
        candidato.origenTipo,
      origenId:
        candidato.origenId,
      referenciaEconomica:
        candidato.referenciaEconomica,
      direccion:
        candidato.direccion
    });

  if (existente) {
    return {
      movimiento: existente,
      creado: false,
      deduplicado: true
    };
  }

  return crearIdempotente({
    empresaId:
      candidato.empresaId,
    sedeId:
      candidato.sedeId,
    direccion:
      candidato.direccion,
    monto:
      candidato.monto,
    moneda: "COP",
    origenTipo:
      candidato.origenTipo,
    origenId:
      candidato.origenId,
    tipoAsiento:
      "CONFIRMACION",
    movimientoOriginalId: null,
    concepto:
      candidato.concepto,
    metodoPago:
      candidato.metodoPago,
    claveIdempotencia:
      candidato.claveIdempotencia,
    referenciaEconomica:
      candidato.referenciaEconomica,
    confirmadoAt:
      candidato.confirmadoAt,
    metadata:
      candidato.metadata,
    createdBy: null,
    deletedAt: null
  });
}

async function reversarMovimiento(candidato) {
  const original =
    await buscarConfirmacionActiva({
      empresaId:
        candidato.empresaId,
      origenTipo:
        candidato.origenTipo,
      origenId:
        candidato.origenId
    });

  if (!original) {
    return {
      movimiento: null,
      creado: false,
      deduplicado: true
    };
  }

  return crearIdempotente({
    empresaId:
      candidato.empresaId,
    sedeId:
      original.sedeId || null,
    direccion:
      original.direccion,
    monto:
      original.monto,
    moneda:
      original.moneda || "COP",
    origenTipo:
      candidato.origenTipo,
    origenId:
      candidato.origenId,
    tipoAsiento:
      "REVERSION",
    movimientoOriginalId:
      original._id,
    concepto:
      `Reversion: ${original.concepto || candidato.concepto}`,
    metodoPago:
      original.metodoPago || "",
    claveIdempotencia:
      candidato.claveIdempotencia,
    referenciaEconomica:
      original.referenciaEconomica ||
      null,
    confirmadoAt:
      fechaSegura(
        candidato.confirmadoAt
      ),
    metadata: {
      ...candidato.metadata,
      revierte:
        String(original._id)
    },
    createdBy: null,
    deletedAt: null
  });
}

async function registrarMovimientoDesdeEvento(
  event,
  opciones = {}
) {
  const {
    emitirEvento = true
  } = opciones;
  const candidato =
    construirCandidatoDesdeEvento(
      event
    );

  if (!candidato) {
    return {
      movimiento: null,
      creado: false,
      ignorado: true
    };
  }

  const resultado =
    candidato.accion === "REVERSAR"
      ? await reversarMovimiento(
          candidato
        )
      : await confirmarMovimiento(
          candidato
        );

  if (
    emitirEvento &&
    resultado.creado &&
    resultado.movimiento
  ) {
    eventBus.emit(
      "CAJA_MOVIMIENTO_REGISTRADO",
      {
        empresaId:
          resultado.movimiento
            .empresaId,
        sedeId:
          resultado.movimiento
            .sedeId,
        movimientoId:
          resultado.movimiento._id,
        origenTipo:
          resultado.movimiento
            .origenTipo,
        origenId:
          resultado.movimiento
            .origenId,
        direccion:
          resultado.movimiento
            .direccion,
        tipoAsiento:
          resultado.movimiento
            .tipoAsiento,
        monto:
          resultado.movimiento.monto,
        fecha:
          resultado.movimiento
            .confirmadoAt
      }
    );
  }

  return {
    ...resultado,
    ignorado: false
  };
}

async function obtenerResumenCaja({
  empresaId,
  sedeId = null,
  desde,
  hasta
}) {
  if (!idValido(empresaId)) {
    throw new Error(
      "CAJA_EMPRESA_ID_INVALIDO"
    );
  }

  if (
    !(desde instanceof Date) ||
    Number.isNaN(desde.getTime()) ||
    !(hasta instanceof Date) ||
    Number.isNaN(hasta.getTime()) ||
    desde >= hasta
  ) {
    throw new Error(
      "CAJA_PERIODO_INVALIDO"
    );
  }

  const match = {
    empresaId:
      new mongoose.Types.ObjectId(
        String(empresaId)
      ),
    deletedAt: null,
    confirmadoAt: {
      $gte: desde,
      $lt: hasta
    }
  };

  if (sedeId) {
    if (!idValido(sedeId)) {
      throw new Error(
        "CAJA_SEDE_ID_INVALIDO"
      );
    }

    match.sedeId =
      new mongoose.Types.ObjectId(
        String(sedeId)
      );
  }

  const rows =
    await MovimientoCaja.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$origenTipo",
          cantidad: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$tipoAsiento",
                    "CONFIRMACION"
                  ]
                },
                1,
                -1
              ]
            }
          },
          monto: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$tipoAsiento",
                    "CONFIRMACION"
                  ]
                },
                "$monto",
                { $multiply: [-1, "$monto"] }
              ]
            }
          }
        }
      }
    ]);

  const porTipo =
    new Map(
      rows.map((row) => [
        row._id,
        {
          cantidad:
            Math.max(
              0,
              Number(row.cantidad || 0)
            ),
          monto:
            Math.max(
              0,
              Number(row.monto || 0)
            )
        }
      ])
    );

  const ventasPagadas =
    porTipo.get("VENTA") || {
      cantidad: 0,
      monto: 0
    };

  const comprasPagadas =
    porTipo.get("COMPRA") || {
      cantidad: 0,
      monto: 0
    };

  const gastosPagados =
    porTipo.get("GASTO") || {
      cantidad: 0,
      monto: 0
    };

  return {
    desde,
    hasta,
    ventasPagadas,
    comprasPagadas,
    gastosPagados,
    entradasConfirmadas:
      ventasPagadas.monto,
    salidasConfirmadas:
      comprasPagadas.monto +
      gastosPagados.monto,
    flujoConfirmadoParcial:
      ventasPagadas.monto -
      comprasPagadas.monto -
      gastosPagados.monto
  };
}

async function reconciliarDocumento({
  origenTipo,
  documento
}) {
  const esPagado =
    origenTipo === "VENTA"
      ? documento.estado === "pagada"
      : (
          documento.estado !== "anulado" &&
          documento.estadoPago === "pagado"
        );

  const payloadBase = {
    empresaId:
      documento.empresaId,
    sedeId:
      documento.sedeId || null,
    metodoPago:
      documento.metodoPago || "",
    fecha:
      documento.fecha,
    sourceUpdatedAt:
      documento.updatedAt,
    cajaReferencia:
      documento.metadata
        ?.cajaReferencia ||
      null
  };

  let event = null;

  if (origenTipo === "VENTA") {
    event = {
      eventName:
        "VENTA_COMPLETADA",
      occurredAt:
        documento.updatedAt ||
        documento.createdAt ||
        documento.fecha ||
        new Date(),
      payload: {
        ...payloadBase,
        ventaId:
          documento._id,
        total:
          documento.total,
        concepto:
          documento.concepto
      }
    };
  }

  if (origenTipo === "COMPRA") {
    event = {
      eventName:
        esPagado
          ? "COMPRA_PAGO_ACTUALIZADO"
          : "COMPRA_PAGO_ACTUALIZADO",
      occurredAt:
        documento.updatedAt ||
        documento.createdAt ||
        documento.fecha ||
        new Date(),
      payload: {
        ...payloadBase,
        compraId:
          documento._id,
        total:
          documento.total,
        proveedor:
          documento.proveedor,
        estadoPagoAnterior:
          esPagado
            ? "pendiente"
            : "pagado",
        estadoPago:
          documento.estadoPago ||
          "pendiente"
      }
    };
  }

  if (origenTipo === "GASTO") {
    event = {
      eventName:
        "GASTO_PAGO_ACTUALIZADO",
      occurredAt:
        documento.updatedAt ||
        documento.createdAt ||
        documento.fecha ||
        new Date(),
      payload: {
        ...payloadBase,
        gastoId:
          documento._id,
        monto:
          documento.monto,
        concepto:
          documento.concepto,
        estadoPagoAnterior:
          esPagado
            ? "pendiente"
            : "pagado",
        estadoPago:
          documento.estadoPago ||
          "desconocido"
      }
    };
  }

  if (!event) return null;

  return registrarMovimientoDesdeEvento(
    event,
    {
      emitirEvento: false
    }
  );
}

async function reconciliarPeriodoCaja({
  empresaId,
  desde,
  hasta
}) {
  if (!idValido(empresaId)) {
    throw new Error(
      "CAJA_EMPRESA_ID_INVALIDO"
    );
  }

  const empresaObjectId =
    new mongoose.Types.ObjectId(
      String(empresaId)
    );

  const filtroFecha = {
    empresaId: empresaObjectId,
    fecha: {
      $gte: desde,
      $lt: hasta
    }
  };

  const [ventas, compras, gastos] =
    await Promise.all([
      Venta.find({
        ...filtroFecha,
        estado: "pagada"
      }).lean(),
      Compra.find({
        ...filtroFecha,
        estado: "registrada"
      }).lean(),
      Gasto.find({
        ...filtroFecha,
        estado: "registrado"
      }).lean()
    ]);

  const resultados = [];

  for (const venta of ventas) {
    resultados.push(
      await reconciliarDocumento({
        origenTipo: "VENTA",
        documento: venta
      })
    );
  }

  for (const compra of compras) {
    resultados.push(
      await reconciliarDocumento({
        origenTipo: "COMPRA",
        documento: compra
      })
    );
  }

  for (const gasto of gastos) {
    resultados.push(
      await reconciliarDocumento({
        origenTipo: "GASTO",
        documento: gasto
      })
    );
  }

  return {
    revisados:
      ventas.length +
      compras.length +
      gastos.length,
    creados:
      resultados.filter(
        (item) => item?.creado
      ).length
  };
}

module.exports = {
  TIPOS_SOPORTADOS,
  construirCandidatoDesdeEvento,
  registrarMovimientoDesdeEvento,
  obtenerResumenCaja,
  reconciliarPeriodoCaja
};
