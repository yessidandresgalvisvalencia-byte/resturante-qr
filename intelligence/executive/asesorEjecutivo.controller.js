"use strict";

const {
  recomendarGanancia
} = require("./asesorEjecutivo.service");

async function obtenerGuiaGanancia(req, res) {
  try {
    const guia = await recomendarGanancia({
      empresaId: req.auth.empresaId,
      cierreId: req.params.cierreId
    });

    return res.json({ ok: true, guia });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        ok: false,
        error: error.message
      });
    }

    console.error("Ejecutivo GRUK ganancia:", error);
    return res.status(500).json({
      ok: false,
      error: "Error construyendo guía ejecutiva de ganancia"
    });
  }
}

module.exports = { obtenerGuiaGanancia };
