const express = require("express");
const router = express.Router();
const auth = require("../core/auth/auth.middleware");
const { ROLES_GRUK, roleCheck } = require("../core/auth/roleCheck.middleware");

const { generarFacturaElectronica } = require("../services/factusService");

router.post("/caja", auth, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE), async (req, res) => {
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
      error: "Error generando factura",
    });
  }
});

module.exports = router;