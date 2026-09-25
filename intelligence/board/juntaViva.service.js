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
  const [ventasPagadas, comprasPagadas, gastosRegistrados] =
    await Promise.all([
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
      })
    ]);

  return {
    desde,
    hasta,
    ventasPagadas,
    comprasPagadas,
    gastosRegistrados,
    flujoConfirmadoParcial:
      ventasPagadas.monto -
      comprasPagadas.monto
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

  if (tipo === "COMPRA_REGISTRADA") {
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

  if (tipo === "GASTO_REGISTRADO") {
    return {
      tipo,
      direccion:
        "SALIDA_REGISTRADA_NO_CONFIRMADA",
      fuenteId: payload.gastoId || null,
      monto: numeroSeguro(payload.monto),
      descripcion:
        `Gasto registrado por ${numeroSeguro(payload.monto)}. GRUK no lo trata como salida confirmada de caja.`,
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
  reportes
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
    ultimoEvento.tipo ===
    "COMPRA_REGISTRADA" &&
    ultimoEvento.direccion ===
      "SALIDA_CONFIRMADA"
  ) {
    titular =
      `Se registro una compra pagada por ${ultimoEvento.monto}.`;
  } else if (
    ultimoEvento.tipo ===
    "GASTO_REGISTRADO"
  ) {
    titular =
      `Se registro un gasto por ${ultimoEvento.monto}; no se asume salida de caja sin confirmacion.`;
  } else if (
    ultimoEvento.tipo ===
    "COMPRA_REGISTRADA"
  ) {
    titular =
      `Se registro una compra por ${ultimoEvento.monto} con pago no confirmado.`;
  }

  const lectura =
    `En las ultimas 24 horas GRUK confirma ${ventana24h.ventasPagadas.cantidad} venta(s) pagada(s) por ${ventana24h.ventasPagadas.monto} y ${ventana24h.comprasPagadas.cantidad} compra(s) pagada(s) por ${ventana24h.comprasPagadas.monto}. El flujo confirmado parcial es ${ventana24h.flujoConfirmadoParcial}. Adicionalmente hay ${ventana24h.gastosRegistrados.cantidad} gasto(s) registrado(s) por ${ventana24h.gastosRegistrados.monto} que no se cuentan como salida confirmada de caja. ${criticos.length ? "Hay KPI criticos que requieren decision del Cerebro." : "La Junta mantiene observacion continua y actualizara esta lectura con el siguiente evento."}`;

  return {
    estado,
    titular,
    lectura,
    razones,
    requiereDecisionCerebro:
      criticos.length > 0
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

  const diagnostico =
    construirDiagnostico({
      ultimoEvento,
      ventana24h,
      reportes
    });

  const filtro = {
    empresaId: empresaObjectId,
    sedeId: sedeObjectId
  };

  const actual = await JuntaEstadoVivo.findOne(
    filtro
  )
    .select("version")
    .lean();

  const version =
    Number(actual?.version || 0) + 1;

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
