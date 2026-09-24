"use strict";

const {
  abrirSesion,
  agregarIntervencion
} = require("./junta.service");

function responderError(res, error, operacion) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      ok: false,
      error: error.message
    });
  }

  console.error(`Junta ${operacion}:`, error);
  return res.status(500).json({
    ok: false,
    error: "Error procesando solicitud de Junta Directiva"
  });
}

async function abrirJunta(req, res) {
  try {
    const sesion = await abrirSesion({
      auth: req.auth,
      decisionId: req.params.decisionId
    });

    return res.json({ ok: true, sesion });
  } catch (error) {
    return responderError(res, error, "abrir");
  }
}

async function intervenir(req, res) {
  try {
    const sesion = await agregarIntervencion({
      auth: req.auth,
      sesionId: req.params.sesionId,
      payload: req.body
    });

    return res.json({ ok: true, sesion });
  } catch (error) {
    return responderError(res, error, "intervenir");
  }
}

module.exports = {
  abrirJunta,
  intervenir
};
