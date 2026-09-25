"use strict";

const mongoose = require("mongoose");

const Venta = require("../../models/Venta");
const Gasto = require("../../models/Gasto");
const Compra = require("../../models/Compra");
const Reporte = require("../models/CerebroReporteNeurona");
const JuntaEstadoVivo = require("./JuntaEstadoVivo");
const { ROLES_GRUK } = require("../../core/auth/roleCheck.middleware");

const NEURONAS = Object.freeze([
  "FINANZAS",
  "VENTAS",
  "MARKETING",
  "OPERACIONES",
  "GENTE"
]);

function serviceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function objectId(valor) {
  if (!mongoose.Types.ObjectId.isValid(valor)) {
    throw serviceError(400, "Identificador invalido");
  }

  return new mongoose.Types.ObjectId(String(valor));
}

function filtroSede(sedeId) {
  return sedeId
    ? { sedeId: objectId(sedeId) }
    : {};
}

function inicioMesUTC(ahora) {
  return new Date(Date.UTC(
    ahora.getUTCFullYear(),
    ahora.getUTCMonth(),
    1,
    0,
    0,
    0,
    0
  ));
}

function numeroSeguro(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

async function agregarResumen({
  Model,
  empresaId,
  sedeId,
  desde,
  hasta,
  filtroExtra,
  campoMonto
}) {
  const match = {
    empresaId: objectId(empresaId),
    ...filtroSede(sedeId),
    ...filtroExtra,
    fecha: {
      $gte: desde,
      $lt: hasta
    }
  };

  const [row] = await Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        cantidad: { $sum: 1 },
        monto: {
          $sum: `$${campoMonto}`
        }
      }
    }
  ]);

  return {
    cantidad: Number(row?.cantidad || 0),
    monto: numeroSeguro(row?.monto)
  };
}

async function construirResumen({
  empresaId,
  sedeId,
  desde,
  hasta
}) {
  const [
    ventasPagadas,
    comprasPagadas,
    gastosRegistrados,
    gastosPagados,
    gastosNoConfirmados
  ] = await Promise.all([
      agregarResumen({
        Model: Venta,
        empresaId,
        sedeId,
        desde,
        hasta,
        filtroExtra: {
          estado: "pagada"
        },
        campoMonto: "total"
      }),
      agregarResumen({
        Model: Compra,
        empresaId,
        sedeId,
        desde,
        hasta,
        filtroExtra: {
          estado: "registrada",
          estadoPago: "pagado"
        },
        campoMonto: "total"
      }),
      agregarResumen({
        Model: Gasto,
        empresaId,
        sedeId,
        desde,
        hasta,
        filtroExtra: {
          estado: "registrado"
        },
        campoMonto: "monto"
      }),
      agregarResumen({
        Model: Gasto,
        empresaId,
        sedeId,
        desde,
        hasta,
        filtroExtra: {
          estado: "registrado",
          estadoPago: "pagado"
        },
        campoMonto: "monto"
      }),
      agregarResumen({
        Model: Gasto,
        empresaId,
        sedeId,
        desde,
        hasta,
        filtroExtra: {
          estado: "registrado",
          estadoPago: { $ne: "pagado" }
        },
        campoMonto: "monto"
      })
    ]);

  return {
    desde,
    hasta,
    ventasPagadas,
    comprasPagadas,
    gastosRegistrados,
    gastosPagados,
    gastosNoConfirmados,
    flujoConfirmadoParcial:
      ventasPagadas.monto -
      comprasPagadas.monto -
      gastosPagados.monto
  };
}

async function ultimosReportes(empresaId) {
  const rows = await Reporte.find({
    empresaId: objectId(empresaId),
    neurona: { $in: NEURONAS },
    deletedAt: null
  })
    .sort({ timestamp: -1 })
    .lean();

  const mapa = new Map();

  for (const row of rows) {
    if (!mapa.has(row.neurona)) {
      mapa.set(row.neurona, row);
    }
  }

  return NEURONAS
    .map((neurona) => mapa.get(neurona))
    .filter(Boolean);
}

function normalizarEvento(event) {
  const tipo = String(
    event?.eventName || "RECALCULO"
  );

  const payload = event?.payload || {};

  if (tipo === "VENTA_COMPLETADA") {
    return {
      tipo,
      direccion: "ENTRADA_CONFIRMADA",
      fuenteId: payload.ventaId || null,
      monto: numeroSeguro(payload.total),
      descripcion:
        `Venta pagada registrada por ${numeroSeguro(payload.total)}.`,
      occurredAt:
        event?.occurredAt || new Date()
    };
  }

  if (
    tipo === "COMPRA_REGISTRADA" ||
    tipo === "COMPRA_PAGO_ACTUALIZADO"
  ) {
    const pagada =
      payload.estadoPago === "pagado";

    return {
      tipo,
      direccion: pagada
        ? "SALIDA_CONFIRMADA"
        : "SALIDA_REGISTRADA_NO_CONFIRMADA",
      fuenteId: payload.compraId || null,
      monto: numeroSeguro(payload.total),
      descripcion: pagada
        ? `Compra pagada registrada por ${numeroSeguro(payload.total)}.`
        : `Compra registrada por ${numeroSeguro(payload.total)} con pago no confirmado.`,
      occurredAt:
        event?.occurredAt || new Date()
    };
  }

  if (
    tipo === "GASTO_REGISTRADO" ||
    tipo === "GASTO_PAGO_ACTUALIZADO"
  ) {
    const pagado =
      payload.estadoPago === "pagado";

    return {
      tipo,
      direccion: pagado
        ? "SALIDA_CONFIRMADA"
        : "SALIDA_REGISTRADA_NO_CONFIRMADA",
      fuenteId: payload.gastoId || null,
      monto: numeroSeguro(payload.monto),
      descripcion: pagado
        ? `Gasto pagado registrado por ${numeroSeguro(payload.monto)}.`
        : `Gasto registrado por ${numeroSeguro(payload.monto)} con pago no confirmado.`,
      occurredAt:
        event?.occurredAt || new Date()
    };
  }

  return {
    tipo: "RECALCULO",
    direccion: "NEUTRO",
    fuenteId: null,
    monto: null,
    descripcion:
      "GRUK recalculo el estado vivo de la Junta.",
    occurredAt:
      event?.occurredAt || new Date()
  };
}

function construirDiagnostico({
  ultimoEvento,
  ventana24h,
  reportes,
  estadoAnterior = null
}) {
  const criticos = reportes.filter(
    (r) =>
      r.kpi_principal?.estado ===
      "CRITICO"
  );

  const alertas = reportes.filter(
    (r) =>
      r.kpi_principal?.estado ===
      "ALERTA"
  );

  const estado = criticos.length
    ? "CRITICO"
    : alertas.length
      ? "ATENCION"
      : "NORMAL";

  const razones = [];

  for (const r of criticos) {
    razones.push(
      `${r.neurona}: ${r.kpi_principal?.nombre || "KPI"} esta CRITICO.`
    );
  }

  for (const r of alertas.slice(0, 3)) {
    razones.push(
      `${r.neurona}: ${r.kpi_principal?.nombre || "KPI"} requiere atencion.`
    );
  }

  let titular =
    "La Junta actualizo su lectura operativa.";

  if (
    ultimoEvento.tipo ===
    "VENTA_COMPLETADA"
  ) {
    titular =
      `Entro una venta pagada por ${ultimoEvento.monto}.`;
  } else if (
    (
      ultimoEvento.tipo === "COMPRA_REGISTRADA" ||
      ultimoEvento.tipo === "COMPRA_PAGO_ACTUALIZADO"
    ) &&
    ultimoEvento.direccion ===
      "SALIDA_CONFIRMADA"
  ) {
    titular =
      `Se registro una compra pagada por ${ultimoEvento.monto}.`;
  } else if (
    (
      ultimoEvento.tipo === "GASTO_REGISTRADO" ||
      ultimoEvento.tipo === "GASTO_PAGO_ACTUALIZADO"
    ) &&
    ultimoEvento.direccion ===
      "SALIDA_CONFIRMADA"
  ) {
    titular =
      `Se confirmo un gasto pagado por ${ultimoEvento.monto}.`;
  } else if (
    ultimoEvento.tipo === "GASTO_REGISTRADO" ||
    ultimoEvento.tipo === "GASTO_PAGO_ACTUALIZADO"
  ) {
    titular =
      `Se registro un gasto por ${ultimoEvento.monto} con pago no confirmado.`;
  } else if (
    ultimoEvento.tipo === "COMPRA_REGISTRADA" ||
    ultimoEvento.tipo === "COMPRA_PAGO_ACTUALIZADO"
  ) {
    titular =
      `Se registro una compra por ${ultimoEvento.monto} con pago no confirmado.`;
  }

  const lectura =
    `En las ultimas 24 horas GRUK confirma ${ventana24h.ventasPagadas.cantidad} venta(s) pagada(s) por ${ventana24h.ventasPagadas.monto}, ${ventana24h.comprasPagadas.cantidad} compra(s) pagada(s) por ${ventana24h.comprasPagadas.monto} y ${ventana24h.gastosPagados.cantidad} gasto(s) pagado(s) por ${ventana24h.gastosPagados.monto}. El flujo confirmado parcial es ${ventana24h.flujoConfirmadoParcial}. Adicionalmente hay ${ventana24h.gastosNoConfirmados.cantidad} gasto(s) por ${ventana24h.gastosNoConfirmados.monto} cuyo pago no esta confirmado y por eso no se descuentan de caja. ${criticos.length ? "Hay KPI criticos que requieren decision del Cerebro." : "La Junta mantiene observacion continua y actualizara esta lectura con el siguiente evento."}`;

  const flujoActual =
    numeroSeguro(
      ventana24h
        ?.flujoConfirmadoParcial
    );

  const flujoAnterior =
    estadoAnterior
      ? numeroSeguro(
          estadoAnterior
            ?.ventana24h
            ?.flujoConfirmadoParcial
        )
      : null;

  let cambioDesdeAnterior = {
    direccion: "INICIAL",
    valor: 0,
    explicacion:
      "Esta es la primera lectura viva disponible."
  };

  if (flujoAnterior !== null) {
    const delta =
      flujoActual - flujoAnterior;

    cambioDesdeAnterior = {
      direccion:
        delta > 0
          ? "AUMENTA_FLUJO_PARCIAL"
          : delta < 0
            ? "REDUCE_FLUJO_PARCIAL"
            : "SIN_CAMBIO",
      valor: Math.abs(delta),
      explicacion:
        delta > 0
          ? `El flujo confirmado parcial aumento en ${Math.abs(delta)} desde la lectura anterior.`
          : delta < 0
            ? `El flujo confirmado parcial se redujo en ${Math.abs(delta)} desde la lectura anterior.`
            : "El flujo confirmado parcial no cambio desde la lectura anterior."
    };
  }

  return {
    estado,
    titular,
    lectura,
    razones,
    requiereDecisionCerebro:
      criticos.length > 0,
    cambioDesdeAnterior
  };
}

function mapearReportes(reportes) {
  return reportes.map((r) => ({
    neurona: r.neurona,
    reporteId: r._id,
    estado:
      r.kpi_principal?.estado || null,
    kpi:
      r.kpi_principal?.nombre || null,
    valorActual:
      r.kpi_principal?.valor_actual ??
      null,
    valorObjetivo:
      r.kpi_principal?.valor_objetivo ??
      null,
    timestamp: r.timestamp
  }));
}

async function recalcularEstadoVivo({
  empresaId,
  sedeId = null,
  event = null,
  ahora = new Date()
}) {
  const empresaObjectId =
    objectId(empresaId);

  const sedeObjectId = sedeId
    ? objectId(sedeId)
    : null;

  const desde24h =
    new Date(
      ahora.getTime() -
      24 * 60 * 60 * 1000
    );

  const desdeMes =
    inicioMesUTC(ahora);

  const [
    ventana24h,
    mesActual,
    reportes
  ] = await Promise.all([
    construirResumen({
      empresaId: empresaObjectId,
      sedeId: sedeObjectId,
      desde: desde24h,
      hasta: ahora
    }),
    construirResumen({
      empresaId: empresaObjectId,
      sedeId: sedeObjectId,
      desde: desdeMes,
      hasta: ahora
    }),
    ultimosReportes(
      empresaObjectId
    )
  ]);

  const ultimoEvento =
    normalizarEvento(event);

  const filtro = {
    empresaId: empresaObjectId,
    sedeId: sedeObjectId
  };

  const actual = await JuntaEstadoVivo.findOne(
    filtro
  )
    .select(
      "version ventana24h diagnostico"
    )
    .lean();

  const version =
    Number(actual?.version || 0) + 1;

  const diagnostico =
    construirDiagnostico({
      ultimoEvento,
      ventana24h,
      reportes,
      estadoAnterior: actual
    });

  return JuntaEstadoVivo.findOneAndUpdate(
    filtro,
    {
      $set: {
        ultimoEvento,
        ventana24h,
        mesActual,
        diagnostico,
        reportesNeuronas:
          mapearReportes(reportes),
        version,
        ultimoCambioAt: ahora,
        deletedAt: null
      },
      $setOnInsert: {
        createdBy: null
      },
      $push: {
        historialDiagnosticos: {
          $each: [
            {
              version,
              estado:
                diagnostico.estado,
              titular:
                diagnostico.titular,
              tipoEvento:
                ultimoEvento.tipo,
              direccionEvento:
                ultimoEvento.direccion,
              montoEvento:
                ultimoEvento.monto,
              flujoConfirmadoParcial:
                ventana24h
                  .flujoConfirmadoParcial,
              createdAt: ahora
            }
          ],
          $slice: -30
        }
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  ).lean();
}

async function obtenerEstadoVivo(auth) {
  const empresaId =
    objectId(auth.empresaId);

  let sedeId = null;

  if (
    auth.rol ===
    ROLES_GRUK.ADMIN_SEDE
  ) {
    if (!auth.sedeId) {
      throw serviceError(
        403,
        "ADMIN_SEDE requiere una sede autorizada"
      );
    }

    sedeId = objectId(auth.sedeId);
  }

  let estado =
    await JuntaEstadoVivo.findOne({
      empresaId,
      sedeId
    }).lean();

  if (!estado) {
    estado = await recalcularEstadoVivo({
      empresaId,
      sedeId,
      event: null
    });
  }

  return estado;
}

module.exports = {
  construirDiagnostico,
  normalizarEvento,
  recalcularEstadoVivo,
  obtenerEstadoVivo
};
