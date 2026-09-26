"use strict";

const {
  obtenerUltimaDecision,
  procesarOrden,
  obtenerAuditoria,
  obtenerPlanesPagoDecision,
  confirmarItemPlanPago
} = require("./cerebro.service");

function responderError(res, error, operacion) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      ok: false,
      error: error.message
    });
  }

  console.error(`Cerebro ${operacion}:`, error);
  return res.status(500).json({
    ok: false,
    error: "Error procesando solicitud del Cerebro"
  });
}

async function ultimaDecision(req, res) {
  try {
    const decision = await obtenerUltimaDecision(req.auth);
    return res.json({
      ok: true,
      decision: decision || null
    });
  } catch (error) {
    return responderError(res, error, "ultima decision");
  }
}

async function confirmarItemPlan(req, res) {
  try {
    const plan =
      await confirmarItemPlanPago({
        auth:
          req.auth,
        planId:
          req.params.planId,
        itemId:
          req.params.itemId
      });

    return res.json({
      ok: true,
      plan
    });
  } catch (error) {
    return responderError(
      res,
      error,
      "confirmar item de plan de pago"
    );
  }
}

async function planesPagoDecision(req, res) {
  try {
    const planes =
      await obtenerPlanesPagoDecision(
        req.auth,
        req.params.decisionId
      );

    return res.json({
      ok: true,
      planes
    });
  } catch (error) {
    return responderError(
      res,
      error,
      "planes de pago"
    );
  }
}

async function auditoriaCerebro(req, res) {
  try {
    const eventos = await obtenerAuditoria(req.auth, req.query?.limit);
    return res.json({ ok: true, eventos });
  } catch (error) {
    return responderError(res, error, "auditoria");
  }
}

function crearProcesadorOrden(accion, operacion) {
  return async function procesar(req, res) {
    try {
      const orden = await procesarOrden({
        auth: req.auth,
        decisionId: req.params.decisionId,
        ordenId: req.params.ordenId,
        accion
      });

      return res.json({
        ok: true,
        orden
      });
    } catch (error) {
      return responderError(res, error, operacion);
    }
  };
}

const aprobarOrden = crearProcesadorOrden("APROBAR", "aprobar orden");
const rechazarOrden = crearProcesadorOrden("RECHAZAR", "rechazar orden");

module.exports = {
  ultimaDecision,
  auditoriaCerebro,
  planesPagoDecision,
  confirmarItemPlan,
  aprobarOrden,
  rechazarOrden
};
