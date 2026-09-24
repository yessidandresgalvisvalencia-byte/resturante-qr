"use strict";

const {
  obtenerSesion,
  abrirSesion,
  agregarIntervencion,
  responderPreguntaExpertos,
  cerrarSesion
} = require("./junta.service");

function mensajePublico(error) {
  if (error.message === "JUNTA_IA_NO_CONFIGURADA") {
    return "La Junta experta todavía no tiene proveedor de IA configurado.";
  }

  if (
    error.message === "JUNTA_IA_JSON_INVALIDO" ||
    error.message === "JUNTA_IA_RESPUESTAS_INCOMPLETAS" ||
    error.message === "JUNTA_IA_RESPUESTA_SIN_TEXTO" ||
    String(error.message || "").startsWith("JUNTA_IA_PROVIDER_ERROR_")
  ) {
    return "Los expertos no pudieron completar la respuesta. La pregunta quedó guardada y puede reintentarse.";
  }

  return error.message;
}

function responderError(res, error, operacion, extra = {}) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      ok: false,
      error: mensajePublico(error),
      ...extra
    });
  }

  console.error(`Junta ${operacion}:`, error);
  return res.status(500).json({
    ok: false,
    error: "Error procesando solicitud de Junta Directiva",
    ...extra
  });
}

async function obtenerJunta(req, res) {
  try {
    const sesion = await obtenerSesion({
      auth: req.auth,
      decisionId: req.params.decisionId
    });

    return res.json({
      ok: true,
      sesion: sesion || null
    });
  } catch (error) {
    return responderError(res, error, "consultar");
  }
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

async function cerrarJunta(req, res) {
  try {
    const sesion = await cerrarSesion({
      auth: req.auth,
      sesionId: req.params.sesionId
    });

    return res.json({ ok: true, sesion });
  } catch (error) {
    return responderError(res, error, "cerrar");
  }
}

async function intervenir(req, res) {
  let guardada = null;

  try {
    guardada = await agregarIntervencion({
      auth: req.auth,
      sesionId: req.params.sesionId,
      payload: req.body
    });

    const sesion = await responderPreguntaExpertos({
      auth: req.auth,
      sesionId: req.params.sesionId,
      intervencionId: guardada.intervencionId
    });

    return res.json({
      ok: true,
      sesion,
      expertosRespondieron: true
    });
  } catch (error) {
    return responderError(
      res,
      error,
      "intervenir",
      guardada
        ? {
            sesion: guardada.sesion,
            preguntaGuardada: true,
            intervencionId: guardada.intervencionId
          }
        : {}
    );
  }
}

async function reintentarRespuesta(req, res) {
  try {
    const sesion = await responderPreguntaExpertos({
      auth: req.auth,
      sesionId: req.params.sesionId,
      intervencionId: req.params.intervencionId
    });

    return res.json({
      ok: true,
      sesion,
      expertosRespondieron: true
    });
  } catch (error) {
    return responderError(res, error, "reintentar respuesta");
  }
}

module.exports = {
  obtenerJunta,
  abrirJunta,
  intervenir,
  reintentarRespuesta,
  cerrarJunta
};
