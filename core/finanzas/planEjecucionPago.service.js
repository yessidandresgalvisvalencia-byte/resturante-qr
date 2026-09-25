"use strict";

const PlanEjecucionPago = require(
  "./models/PlanEjecucionPago"
);

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
                "PENDIENTE_CONFIRMACION"
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

module.exports = {
  crearPlanDesdeDecision
};
