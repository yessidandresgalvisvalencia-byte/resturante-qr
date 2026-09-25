"use strict";

const mongoose = require("mongoose");

const Gasto = require("../../models/Gasto");
const Compra = require("../../models/Compra");
const {
  obtenerResumenCaja,
  reconciliarPeriodoCaja
} = require("../../core/finanzas/caja.service");
const Reporte = require("../models/CerebroReporteNeurona");
const JuntaEstadoVivo = require("./JuntaEstadoVivo");
const {
  generarRespuestasExpertas
} = require("./expertos.service");
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
    caja,
    comprasNoConfirmadas,
    gastosRegistrados,
    gastosNoConfirmados
  ] = await Promise.all([
    obtenerResumenCaja({
      empresaId,
      sedeId,
      desde,
      hasta
    }),
    agregarResumen({
      Model: Compra,
      empresaId,
      sedeId,
      desde,
      hasta,
      filtroExtra: {
        estado: "registrada",
        estadoPago: {
          $ne: "pagado"
        }
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
        estadoPago: {
          $ne: "pagado"
        }
      },
      campoMonto: "monto"
    })
  ]);

  return {
    desde,
    hasta,
    ventasPagadas:
      caja.ventasPagadas,
    comprasPagadas:
      caja.comprasPagadas,
    comprasNoConfirmadas,
    gastosRegistrados,
    gastosPagados:
      caja.gastosPagados,
    gastosNoConfirmados,
    entradasConfirmadas:
      caja.entradasConfirmadas,
    salidasConfirmadas:
      caja.salidasConfirmadas,
    flujoConfirmadoParcial:
      caja.flujoConfirmadoParcial
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

  const flujoParcial =
    numeroSeguro(
      ventana24h
        ?.flujoConfirmadoParcial
    );

  const flujoParcialNegativo =
    flujoParcial < 0;

  const estado = criticos.length
    ? "CRITICO"
    : (
        alertas.length ||
        flujoParcialNegativo
      )
      ? "ATENCION"
      : "NORMAL";

  const razones = [];

  if (flujoParcialNegativo) {
    razones.push(
      `En las ultimas 24 horas las salidas confirmadas superan las entradas confirmadas por ${Math.abs(flujoParcial)}. Esto no equivale a saldo de caja negativo; es una señal de flujo parcial.`
    );
  }

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
    `Este indicador no es el saldo bancario ni la caja total de la empresa; mide movimientos confirmados que GRUK puede demostrar. En las ultimas 24 horas GRUK confirma ${ventana24h.ventasPagadas.cantidad} venta(s) pagada(s) por ${ventana24h.ventasPagadas.monto}, ${ventana24h.comprasPagadas.cantidad} compra(s) pagada(s) por ${ventana24h.comprasPagadas.monto} y ${ventana24h.gastosPagados.cantidad} gasto(s) pagado(s) por ${ventana24h.gastosPagados.monto}. El flujo confirmado parcial es ${ventana24h.flujoConfirmadoParcial}. Adicionalmente hay ${ventana24h.gastosNoConfirmados.cantidad} gasto(s) por ${ventana24h.gastosNoConfirmados.monto} cuyo pago no esta confirmado y por eso no se descuentan de caja. ${criticos.length ? "Hay KPI criticos que requieren decision del Cerebro." : "La Junta mantiene observacion continua y actualizara esta lectura con el siguiente evento."}`;

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

function construirPreguntaAutomatica(
  ultimoEvento
) {
  const monto =
    numeroSeguro(
      ultimoEvento?.monto
    );

  if (
    ultimoEvento?.tipo ===
    "VENTA_COMPLETADA"
  ) {
    return (
      `Hoy hice una venta de ${monto} pesos y ya la cobre; GRUK confirma el ingreso. ` +
      "Analiza que cambia en caja, ventas, margen, capacidad y riesgo."
    );
  }

  if (
    ultimoEvento?.tipo ===
      "COMPRA_REGISTRADA" ||
    ultimoEvento?.tipo ===
      "COMPRA_PAGO_ACTUALIZADO"
  ) {
    if (
      ultimoEvento.direccion ===
      "SALIDA_CONFIRMADA"
    ) {
      return (
        `Hoy compre insumos por ${monto} pesos y el pago ya fue confirmado. ` +
        "Analiza el efecto en flujo de caja, inventario, margen y continuidad operativa."
      );
    }

    return (
      `Existe una compra por ${monto} pesos cuyo pago sigue pendiente. ` +
      "Analiza el compromiso sobre flujo de caja, inventario y capital de trabajo sin tratarlo como dinero ya pagado."
    );
  }

  if (
    ultimoEvento?.tipo ===
      "GASTO_REGISTRADO" ||
    ultimoEvento?.tipo ===
      "GASTO_PAGO_ACTUALIZADO"
  ) {
    if (
      ultimoEvento.direccion ===
      "SALIDA_CONFIRMADA"
    ) {
      return (
        `Hoy pague un gasto de ${monto} pesos y GRUK confirma la salida. ` +
        "Analiza el efecto en flujo de caja, necesidad del gasto y riesgo financiero."
      );
    }

    return (
      `Existe un gasto registrado por ${monto} pesos cuyo pago no esta confirmado. ` +
      "Analiza el compromiso sobre flujo de caja sin asumir que el dinero ya salio."
    );
  }

  return (
    "Analiza el estado actual del flujo de caja y los KPI de GRUK. " +
    "Distingue hechos confirmados, riesgos y datos faltantes sin inventar causas."
  );
}

function enriquecerReportesConCaja(
  reportes,
  ventana24h
) {
  const evidenciaCaja =
    "CAJA GRUK 24H: " +
    `entradas confirmadas ${numeroSeguro(ventana24h?.entradasConfirmadas)}, ` +
    `salidas confirmadas ${numeroSeguro(ventana24h?.salidasConfirmadas)}, ` +
    `flujo confirmado parcial ${numeroSeguro(ventana24h?.flujoConfirmadoParcial)}. ` +
    "Este flujo parcial no equivale al saldo bancario ni a la caja total.";

  return (reportes || []).map(
    (reporte) => {
      if (
        reporte.neurona !==
        "FINANZAS"
      ) {
        return reporte;
      }

      return {
        ...reporte,
        hallazgos: [
          ...(reporte.hallazgos || []),
          {
            tipo:
              "CAJA_CONFIRMADA_24H",
            evidencia:
              evidenciaCaja,
            impacto_financiero_estimado:
              Math.abs(
                numeroSeguro(
                  ventana24h
                    ?.flujoConfirmadoParcial
                )
              ),
            confianza: 100
          }
        ]
      };
    }
  );
}

async function generarDiagnosticosAutomaticos({
  ultimoEvento,
  ventana24h,
  reportes,
  ahora
}) {
  const pregunta =
    construirPreguntaAutomatica(
      ultimoEvento
    );

  const resultado =
    await generarRespuestasExpertas({
      pregunta,
      decision: null,
      reportes:
        enriquecerReportesConCaja(
          reportes,
          ventana24h
        ),
      intervenciones: []
    });

  return (resultado.respuestas || [])
    .filter(
      (item) =>
        item.relevancia === "ALTA" ||
        item.relevancia === "MEDIA" ||
        item.departamento ===
          "DIRECCION"
    )
    .map((item) => ({
      departamento:
        item.departamento,
      relevancia:
        item.relevancia || "MEDIA",
      respuesta:
        String(
          item.respuesta || ""
        ).slice(0, 3000),
      criterioProfesional:
        String(
          item.criterio_profesional ||
          ""
        ).slice(0, 1800),
      evidencia:
        (item.evidencia_usada || [])
          .map((valor) =>
            String(valor)
              .slice(0, 700)
          )
          .slice(0, 8),
      riesgos:
        (item.riesgos || [])
          .map((valor) =>
            String(valor)
              .slice(0, 500)
          )
          .slice(0, 6),
      datosFaltantes:
        (item.datos_faltantes || [])
          .map((valor) =>
            String(valor)
              .slice(0, 400)
          )
          .slice(0, 8),
      confianza:
        Number.isFinite(
          Number(item.confianza)
        )
          ? Math.max(
              0,
              Math.min(
                100,
                Number(
                  item.confianza
                )
              )
            )
          : null,
      generatedAt: ahora
    }));
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

  const filtro = {
    empresaId: empresaObjectId,
    sedeId: sedeObjectId
  };

  const actual = await JuntaEstadoVivo.findOne(
    filtro
  )
    .select(
      "version ventana24h diagnostico ultimoEvento diagnosticosExpertos"
    )
    .lean();

  const esRecalculoSistema =
    [
      "CICLO_INTELIGENCIA_COMPLETADO",
      "CAJA_MOVIMIENTO_REGISTRADO",
      "CAJA_RECONCILIADA"
    ].includes(
      event?.eventName
    );

  const eventoNormalizado =
    normalizarEvento(event);

  const ultimoEvento =
    esRecalculoSistema &&
    actual?.ultimoEvento
      ? actual.ultimoEvento
      : eventoNormalizado;

  const tipoEventoHistorial =
    esRecalculoSistema
      ? String(
          event?.eventName ||
          "RECALCULO"
        )
      : ultimoEvento.tipo;

  const direccionEventoHistorial =
    esRecalculoSistema
      ? "NEUTRO"
      : ultimoEvento.direccion;

  const montoEventoHistorial =
    esRecalculoSistema
      ? null
      : ultimoEvento.monto;

  const version =
    Number(actual?.version || 0) + 1;

  const diagnostico =
    construirDiagnostico({
      ultimoEvento,
      ventana24h,
      reportes,
      estadoAnterior: actual
    });

  let diagnosticosExpertos =
    actual?.diagnosticosExpertos || [];

  try {
    diagnosticosExpertos =
      await generarDiagnosticosAutomaticos({
        ultimoEvento,
        ventana24h,
        reportes,
        ahora
      });
  } catch (error) {
    console.error(
      "[GRUK JUNTA VIVA] diagnostico experto automatico fallo",
      {
        empresaId:
          String(empresaObjectId),
        error:
          error instanceof Error
            ? error.message
            : String(error)
      }
    );
  }

  return JuntaEstadoVivo.findOneAndUpdate(
    filtro,
    {
      $set: {
        ultimoEvento,
        ventana24h,
        mesActual,
        diagnostico,
        diagnosticosExpertos,
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
                tipoEventoHistorial,
              direccionEvento:
                direccionEventoHistorial,
              montoEvento:
                montoEventoHistorial,
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
    const ahora = new Date();
    const desde =
      inicioMesUTC(ahora);
    const hasta =
      new Date(
        Date.UTC(
          ahora.getUTCFullYear(),
          ahora.getUTCMonth() + 1,
          1,
          0,
          0,
          0,
          0
        )
      );

    await reconciliarPeriodoCaja({
      empresaId,
      desde,
      hasta
    });

    estado = await recalcularEstadoVivo({
      empresaId,
      sedeId,
      event: null,
      ahora
    });
  }

  return estado;
}

module.exports = {
  construirDiagnostico,
  construirPreguntaAutomatica,
  enriquecerReportesConCaja,
  generarDiagnosticosAutomaticos,
  normalizarEvento,
  recalcularEstadoVivo,
  obtenerEstadoVivo
};
