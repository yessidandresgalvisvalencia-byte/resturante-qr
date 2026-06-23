const express = require("express");
const router = express.Router();

const { generarFacturaElectronica } = require("../services/factusService");

router.post("/caja", async (req, res) => {
  try {
    const pago = req.body;

    const respuestaFactura = await generarFacturaElectronica(pago);

    res.json({
      ok: true,
      mensaje: "Factura procesada en modo GRUK",
      factura: respuestaFactura,
    });
  } catch (error) {
    console.error("Error facturación caja:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error generando factura",
      error: error.message,
    });
  }
});

module.exports = router;