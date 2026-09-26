"use strict";

const mongoose = require("mongoose");
const Decision = require("../models/CerebroDecision");
const Auditoria = require("../models/CerebroAuditoria");
const JuntaSesion = require("../board/JuntaSesion");
const CerebroMemoria = require("../memory/CerebroMemoria");
const PlanEjecucionPago = require("../../core/finanzas/models/PlanEjecucionPago");
const { ROLES_GRUK } = require("../../core/auth/roleCheck.middleware");
const { registrarBaselineAprobacion } = require("../memory/memoria.service");
const {
  crearPlanDesdeDecision,
  confirmarItemPagado
} = require("../../core/finanzas/planEjecucionPago.service");

function serviceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function filtroTenant(auth, extra = {}) {
  const filtro = {
    empresaId: auth.empresaId,
    deletedAt: null,
    ...extra
  };

  if (auth.rol === ROLES_GRUK.ADMIN_SEDE) {
    if (!auth.sedeId) {
      throw serviceError(403, "ADMIN_SEDE requiere una sede autorizada");
    }
    filtro.sedeId = auth.sedeId;
  }

  return filtro;
}

async function obtenerUltimaDecision(auth) {
  return Decision.findOne(filtroTenant(auth))
    .sort({ createdAt: -1 })
    .lean();
}

async function procesarOrden({ auth, decisionId, ordenId, accion }) {
  if (!mongoose.Types.ObjectId.isValid(decisionId) ||
      !mongoose.Types.ObjectId.isValid(ordenId)) {
    throw serviceError(400, "Identificador invalido");
  }
  if (!mongoose.Types.ObjectId.isValid(auth.usuarioId)) {
    throw serviceError(401, "Identidad de usuario invalida");
  }
  if (!["APROBAR", "RECHAZAR"].includes(accion)) {
    throw serviceError(400, "Accion invalida");
  }

  const session = await mongoose.startSession();
  try {
    let ordenRespuesta = null;
    await session.withTransaction(async () => {
      const decision = await Decision.findOne(
        filtroTenant(auth, { _id: decisionId })
      ).session(session);

      if (!decision) throw serviceError(404, "Decision no encontrada");

      const orden = decision.ordenes_por_departamento.id(ordenId);
      if (!orden) throw serviceError(404, "Orden no encontrada");
      if (orden.estado !== "PENDIENTE_APROBACION") {
        throw serviceError(409, "La orden ya fue procesada");
      }

      if (accion === "APROBAR") {
        orden.estado = "APROBADA";
        orden.aprobadaPor = auth.usuarioId;
        orden.aprobadaAt = new Date();
      } else {
        orden.estado = "RECHAZADA";
      }

      await decision.save({ session });

      if (accion === "APROBAR") {
        await registrarBaselineAprobacion({
          auth,
          decision,
          orden,
          session
        });

        await crearPlanDesdeDecision({
          decision,
          orden,
          createdBy:
            auth.usuarioId,
          session
        });
      }

      await Auditoria.create([{
        empresaId: auth.empresaId,
        sedeId: auth.sedeId || null,
        decisionId: decision._id,
        ordenId: orden._id,
        accion,
        usuarioId: auth.usuarioId,
        metadata: { rol: auth.rol }
      }], { session });

      ordenRespuesta = orden.toObject();
    });
    return ordenRespuesta;
  } finally {
    await session.endSession();
  }
}

async function confirmarItemPlanPago({
  auth,
  planId,
  itemId
}) {
  if (
    !mongoose.Types.ObjectId.isValid(
      auth.usuarioId
    )
  ) {
    throw serviceError(
      401,
      "Identidad de usuario invalida"
    );
  }

  return confirmarItemPagado({
    empresaId:
      auth.empresaId,
    sedeId:
      auth.rol ===
      ROLES_GRUK.ADMIN_SEDE
        ? auth.sedeId
        : null,
    planId,
    itemId,
    confirmadoBy:
      auth.usuarioId
  });
}

async function obtenerPlanesPagoDecision(
  auth,
  decisionId
) {
  if (
    !mongoose.Types.ObjectId.isValid(
      decisionId
    )
  ) {
    throw serviceError(
      400,
      "decisionId invalido"
    );
  }

  const decision =
    await Decision.findOne(
      filtroTenant(
        auth,
        { _id: decisionId }
      )
    )
      .select("_id")
      .lean();

  if (!decision) {
    throw serviceError(
      404,
      "Decision no encontrada"
    );
  }

  const filtro = {
    empresaId:
      auth.empresaId,
    decisionId:
      decision._id,
    deletedAt: null
  };

  if (
    auth.rol ===
    ROLES_GRUK.ADMIN_SEDE
  ) {
    filtro.sedeId =
      auth.sedeId;
  }

  return PlanEjecucionPago.find(
    filtro
  )
    .sort({
      createdAt: 1
    })
    .lean();
}

async function obtenerAuditoria(auth, limite = 100) {
  const maximo = Math.max(1, Math.min(200, Number(limite) || 100));

  const [accionesOrden, juntas, memorias, planesPago] = await Promise.all([
    Auditoria.find(filtroTenant(auth))
      .sort({ createdAt: -1 })
      .limit(maximo)
      .lean(),
    JuntaSesion.find(filtroTenant(auth))
      .sort({ createdAt: -1 })
      .limit(maximo)
      .lean(),
    CerebroMemoria.find(filtroTenant(auth))
      .sort({ createdAt: -1 })
      .limit(maximo)
      .lean(),
    PlanEjecucionPago.find(
      filtroTenant(auth)
    )
      .sort({ createdAt: -1 })
      .limit(maximo)
      .lean()
  ]);

  const decisionIds = [...new Set([
    ...accionesOrden.map((evento) => String(evento.decisionId)),
    ...juntas.map((sesion) => String(sesion.decisionId)),
    ...memorias.map((memoria) => String(memoria.decisionId)),
    ...planesPago.map((plan) => String(plan.decisionId))
  ])];

  const decisiones = decisionIds.length
    ? await Decision.find({
        ...filtroTenant(auth),
        _id: { $in: decisionIds }
      }).lean()
    : [];

  const mapaDecisiones = new Map(
    decisiones.map((decision) => [String(decision._id), decision])
  );

  const eventos = [];

  for (const evento of accionesOrden) {
    const decision = mapaDecisiones.get(String(evento.decisionId)) || null;
    const orden = decision?.ordenes_por_departamento?.find(
      (item) => String(item._id) === String(evento.ordenId)
    ) || null;

    eventos.push({
      _id: String(evento._id),
      tipo: "ORDEN",
      accion: evento.accion,
      actor:
        evento.accion === "SUPERAR"
          ? "SISTEMA"
          : "HUMANO",
      usuarioId:
        evento.usuarioId || null,
      rol:
        evento.metadata?.rol || null,
      createdAt: evento.createdAt,
      decisionId: evento.decisionId,
      ordenId: evento.ordenId,
      departamento: orden?.departamento || null,
      tarea: orden?.tarea || null,
      kpi_a_medir: orden?.kpi_a_medir || null,
      situacion: decision?.decision_general?.situacion || null
    });
  }

  for (const sesion of juntas) {
    const decision = mapaDecisiones.get(String(sesion.decisionId)) || null;
    const situacion = decision?.decision_general?.situacion || null;

    eventos.push({
      _id: `junta-abrir-${sesion._id}`,
      tipo: "JUNTA",
      accion: "JUNTA_ABIERTA",
      actor: "HUMANO",
      usuarioId: sesion.createdBy,
      rol: null,
      createdAt: sesion.createdAt,
      decisionId: sesion.decisionId,
      ordenId: null,
      departamento: "DIRECCION",
      tarea: "Se abrió la discusión de Junta Directiva con evidencia de las cinco neuronas.",
      kpi_a_medir: null,
      situacion
    });

    for (const intervencion of sesion.intervenciones || []) {
      if (intervencion.tipo === "HUMANO") {
        eventos.push({
          _id: `junta-intervencion-${intervencion._id}`,
          tipo: "JUNTA",
          accion: "JUNTA_INTERVENCION",
          actor: "HUMANO",
          usuarioId: intervencion.autorUsuarioId,
          rol: null,
          modelo: null,
          createdAt: intervencion.createdAt,
          decisionId: sesion.decisionId,
          ordenId: null,
          departamento: intervencion.departamento,
          tarea: intervencion.mensaje,
          kpi_a_medir: null,
          situacion
        });
      }

      if (["EXPERTO_GRUK", "EXPERTO_IA"].includes(intervencion.tipo)) {
        eventos.push({
          _id: `junta-experto-${intervencion._id}`,
          tipo: "JUNTA",
          accion: "JUNTA_RESPUESTA_EXPERTA",
          actor: intervencion.tipo === "EXPERTO_GRUK" ? "GRUK" : "IA",
          usuarioId: null,
          rol: null,
          modelo: intervencion.modelo || null,
          createdAt: intervencion.createdAt,
          decisionId: sesion.decisionId,
          ordenId: null,
          departamento: intervencion.departamento,
          tarea: intervencion.mensaje,
          kpi_a_medir: null,
          situacion
        });
      }
    }

    if (sesion.closedAt) {
      eventos.push({
        _id: `junta-cerrar-${sesion._id}`,
        tipo: "JUNTA",
        accion: "JUNTA_CERRADA",
        actor: "HUMANO",
        usuarioId: sesion.closedBy,
        rol: null,
        createdAt: sesion.closedAt,
        decisionId: sesion.decisionId,
        ordenId: null,
        departamento: "DIRECCION",
        tarea: "Se cerró la discusión de Junta Directiva.",
        kpi_a_medir: null,
        situacion
      });
    }
  }

  for (const plan of planesPago) {
    const decision =
      mapaDecisiones.get(
        String(plan.decisionId)
      ) || null;

    eventos.push({
      _id:
        `plan-pago-${plan._id}`,
      tipo:
        "PLAN_PAGO",
      accion:
        "PLAN_PAGO_CREADO",
      actor:
        "HUMANO",
      usuarioId:
        plan.createdBy,
      rol:
        null,
      createdAt:
        plan.createdAt,
      decisionId:
        plan.decisionId,
      ordenId:
        plan.ordenId,
      departamento:
        "DIRECCION",
      tarea:
        `Plan de pago autorizado por ${Number(plan.totalAutorizado || 0)}.`,
      kpi_a_medir:
        "obligaciones_7d_cubiertas",
      situacion:
        decision
          ?.decision_general
          ?.situacion || null
    });

    for (
      const item of
      plan.items || []
    ) {
      if (
        item.estado !==
        "CONFIRMADO" ||
        !item.confirmadoAt
      ) {
        continue;
      }

      eventos.push({
        _id:
          `plan-pago-item-${item._id}`,
        tipo:
          "PLAN_PAGO",
        accion:
          "PAGO_VERIFICADO_EN_CAJA",
        actor:
          "HUMANO",
        usuarioId:
          item.confirmadoBy || null,
        rol:
          null,
        createdAt:
          item.confirmadoAt,
        decisionId:
          plan.decisionId,
        ordenId:
          plan.ordenId,
        departamento:
          "FINANZAS",
        tarea:
          `Pago verificado en Caja: ${item.descripcion || "obligacion"} por ${Number(item.monto || 0)}.`,
        kpi_a_medir:
          "obligaciones_7d_cubiertas",
        situacion:
          decision
            ?.decision_general
            ?.situacion || null,
        movimientoCajaId:
          item.movimientoCajaId || null
      });
    }
  }

  for (const memoria of memorias) {
    if (memoria.resultado === "PENDIENTE" || !memoria.seguimiento?.measuredAt) {
      continue;
    }

    const decision = mapaDecisiones.get(String(memoria.decisionId)) || null;

    eventos.push({
      _id: `memoria-${memoria._id}`,
      tipo: "MEMORIA",
      accion: "MEMORIA_EVALUADA",
      actor: "SISTEMA",
      usuarioId: null,
      rol: null,
      createdAt: memoria.seguimiento.measuredAt,
      decisionId: memoria.decisionId,
      ordenId: memoria.ordenId,
      departamento: memoria.departamento,
      tarea: `Resultado a 7 días: ${memoria.resultado}.`,
      kpi_a_medir: memoria.kpi,
      situacion: decision?.decision_general?.situacion || null
    });
  }

  return eventos
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, maximo);
}

module.exports = {
  obtenerUltimaDecision,
  procesarOrden,
  obtenerAuditoria,
  obtenerPlanesPagoDecision,
  confirmarItemPlanPago,
  filtroTenant
};
