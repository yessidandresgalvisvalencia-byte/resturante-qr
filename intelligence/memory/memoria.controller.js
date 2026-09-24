"use strict";

const {
  obtenerMemorias
} = require("./memoria.service");

function responderError(res, error) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      ok: false,
      error: error.message
    });
  }

  console.error("Memoria Cerebro:", error);
  return res.status(500).json({
    ok: false,
    error: "Error consultando memoria de resultados"
  });
}

async function listarMemorias(req, res) {
  try {
    const memorias = await obtenerMemorias(
      req.auth,
      req.query?.limit
    );

    return res.json({
      ok: true,
      memorias
    });
  } catch (error) {
    return responderError(res, error);
  }
}

module.exports = {
  listarMemorias
};
