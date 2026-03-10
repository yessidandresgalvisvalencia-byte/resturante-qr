console.log("PUBLIC KEY:", process.env.WOMPI_PUBLIC_KEY);
console.log("INTEGRITY KEY:", process.env.WOMPI_INTEGRITY_KEY);
const crypto = require("crypto");

const router = express.Router();

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

    if (!publicKey || !integrityKey) {
      return res.status(500).json({
        ok: false,
        error: "Faltan WOMPI_PUBLIC_KEY o WOMPI_INTEGRITY_KEY en el archivo .env"
      });
    }

    const reference = `PEDIDO_${Date.now()}`;
    const currency = "COP";

    const cadena = `${reference}${monto}${currency}${integrityKey}`;
    const signature = crypto.createHash("sha256").update(cadena).digest("hex");

    return res.json({
      ok: true,
      publicKey,
      currency,
      amountInCents: monto,
      reference,
      signature
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