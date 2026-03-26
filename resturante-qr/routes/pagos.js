const express = require("express");
const crypto = require("crypto");

const router = express.Router();

router.get("/debug", (req, res) => {
  res.json({
    ok: true,
    appUrl: process.env.APP_URL || null,
    publicKeyExists: !!process.env.WOMPI_PUBLIC_KEY,
    integrityKeyExists: !!process.env.WOMPI_INTEGRITY_KEY,
    appUrl: process.env.APP_URL || null,
    publicKeyPreview: process.env.WOMPI_PUBLIC_KEY
      ? process.env.WOMPI_PUBLIC_KEY.slice(0, 12)
      : null
  });
});

router.post("/crear-pago", (req, res) => {
  try {
    const monto = Number(req.body.monto);

    if (!monto || monto <= 0) {
      return res.status(400).json({
        ok: false,
        error: "El monto es inválido"
      });
    }

    const publicKey = process.env.WOMPI_PUBLIC_KEY;
    const integrityKey = process.env.WOMPI_INTEGRITY_KEY;
    const appUrl = process.env.APP_URL;

    if (!publicKey) {
      return res.status(500).json({ ok: false, error: "Falta WOMPI_PUBLIC_KEY" });
    }

    if (!integrityKey) {
      return res.status(500).json({ ok: false, error: "Falta WOMPI_INTEGRITY_KEY" });
    }

    if (!appUrl) {
      return res.status(500).json({ ok: false, error: "Falta APP_URL" });
    }

    const reference = `PEDIDO_${Date.now()}`;
    const currency = "COP";

    const cadena = `${reference}${monto}${currency}${integrityKey}`;
    const signature = crypto
      .createHash("sha256")
      .update(cadena)
      .digest("hex");

    return res.json({
      ok: true,
      publicKey,
      currency,
      amountInCents: monto,
      reference,
      signature,
      redirectUrl: `${appUrl}/carrito.html`
    });
  } catch (error) {
    console.error("Error en /crear-pago:", error);
    return res.status(500).json({
      ok: false,
      error: "Error interno al crear el pago"
    });
  }
});

module.exports = router;