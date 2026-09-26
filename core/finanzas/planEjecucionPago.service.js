"use strict";

const mongoose = require("mongoose");
const PlanEjecucionPago = require(
  "./models/PlanEjecucionPago"
);
const MovimientoCaja = require(
  "./models/MovimientoCaja"
);
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

async function crearPlanDesdeDecision({
  decision,
  orden,
  createdBy,
  session
}) {
  if (
    orden?.kpi_a_medir !==
    "obligaciones_7d_cubiertas"
  ) {
    return null;
  }

  const contexto =
    decision
      ?.contexto_financiero;

  const items =
    Array.isArray(
      contexto
        ?.planPagosCajaActual
    )
      ? contexto
          .planPagosCajaActual
          .filter(
            (item) =>
              item.estadoCobertura ===
              "CUBIERTA" &&
              Number(item.monto) > 0 &&
              item.origenId &&
              item.tipo
          )
          .map(
            (item) => ({
              origenTipo:
                item.tipo,
              origenId:
                item.origenId,
              descripcion:
                item.descripcion || "",
              monto:
                Number(item.monto),
              fechaVencimiento:
                item.fechaVencimiento || null,
              estado:
                item.tipo === "RECURRENTE"
                  ? "REQUIERE_REGISTRO_PAGO"
                  : "PENDIENTE_CONFIRMACION"
            })
          )
      : [];

  if (!items.length) {
    return null;
  }

  const totalAutorizado =
    items.reduce(
      (total, item) =>
        total +
        Number(item.monto || 0),
      0
    );

  const [plan] =
    await PlanEjecucionPago.create(
      [
        {
          empresaId:
            decision.empresaId,
          sedeId:
            decision.sedeId || null,
          decisionId:
            decision._id,
          ordenId:
            orden._id,
          saldoDisponibleSnapshot:
            Number(
              contexto
                ?.saldoActual || 0
            ),
          totalAutorizado,
          items,
          createdBy,
          deletedAt: null
        }
      ],
      { session }
    );

  return plan;
}

async function confirmarItemPagado({
  empresaId,
  sedeId = null,
  planId,
  itemId,
  confirmadoBy
}) {
  const filtro = {
    _id:
      objectId(
        planId,
        "planId"
      ),
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

  const plan =
    await PlanEjecucionPago.findOne(
      filtro
    );

  if (!plan) {
    throw serviceError(
      404,
      "Plan de pago no encontrado"
    );
  }

  const item =
    plan.items.id(
      objectId(
        itemId,
        "itemId"
      )
    );

  if (!item) {
    throw serviceError(
      404,
      "Item del plan no encontrado"
    );
  }

  if (
    item.estado ===
    "CONFIRMADO"
  ) {
    return plan.toObject();
  }

  if (
    item.estado ===
    "REQUIERE_REGISTRO_PAGO"
  ) {
    throw serviceError(
      409,
      "La obligacion recurrente requiere primero un documento y pago real registrado en GRUK"
    );
  }

  if (
    !["COMPRA", "GASTO"].includes(
      item.origenTipo
    )
  ) {
    throw serviceError(
      409,
      "El item no tiene un origen de caja confirmable"
    );
  }

  const confirmacion =
    await MovimientoCaja.findOne({
      empresaId:
        plan.empresaId,
      origenTipo:
        item.origenTipo,
      origenId:
        item.origenId,
      direccion:
        "SALIDA",
      tipoAsiento:
        "CONFIRMACION",
      deletedAt: null
    })
      .sort({
        confirmadoAt: -1
      })
      .lean();

  if (!confirmacion) {
    throw serviceError(
      409,
      "No existe una salida de caja confirmada para esta obligacion"
    );
  }

  const reversion =
    await MovimientoCaja.findOne({
      empresaId:
        plan.empresaId,
      tipoAsiento:
        "REVERSION",
      movimientoOriginalId:
        confirmacion._id,
      deletedAt: null
    })
      .select("_id")
      .lean();

  if (reversion) {
    throw serviceError(
      409,
      "La salida de caja fue revertida y no puede confirmar este pago"
    );
  }

  item.estado =
    "CONFIRMADO";
  item.confirmadoAt =
    new Date();
  item.confirmadoBy =
    objectId(
      confirmadoBy,
      "confirmadoBy"
    );
  item.movimientoCajaId =
    confirmacion._id;

  const todosConfirmados =
    plan.items.every(
      (x) =>
        x.estado ===
          "CONFIRMADO" ||
        x.estado ===
          "CANCELADO"
    );

  if (todosConfirmados) {
    plan.estado =
      "COMPLETADO";
    plan.completedAt =
      new Date();
  }

  await plan.save();

  eventBus.emit(
    "PLAN_PAGO_ITEM_CONFIRMADO",
    {
      empresaId:
        plan.empresaId,
      sedeId:
        plan.sedeId,
      planId:
        plan._id,
      itemId:
        item._id,
      movimientoCajaId:
        confirmacion._id,
      confirmadoBy:
        item.confirmadoBy
    }
  );

  return plan.toObject();
}

module.exports = {
  crearPlanDesdeDecision,
  confirmarItemPagado
};
