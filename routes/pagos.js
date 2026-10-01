"use strict";
const express = require("express");
const crypto = require("crypto");
const Pedido = require("../models/pedido");
const IntentoPagoPedido = require("../models/IntentoPagoPedido");

const router = express.Router();

router.post("/crear-pago", async (req, res) => {
  try {
    const restaurantId = String(req.body?.restaurantId || "").trim();
    const mesa = Number(req.body?.mesa);
    if (!restaurantId || !Number.isInteger(mesa) || mesa <= 0) {
      return res.status(400).json({ ok: false, error: "restaurantId y mesa son obligatorios" });
    }

    const publicKey = process.env.WOMPI_PUBLIC_KEY;
    const integrityKey = process.env.WOMPI_INTEGRITY_KEY;
    const appUrl = String(process.env.APP_URL || "").replace(/\/$/, "");
    if (!publicKey || !integrityKey || !appUrl) {
      return res.status(503).json({ ok: false, error: "Pasarela de pagos no configurada" });
    }

    const pedidos = await Pedido.find({
      restaurantId,
      mesa,
      estadoPago: "pendiente"
    }).select("_id precio").sort({ createdAt: 1 }).lean();

    if (!pedidos.length) return res.status(409).json({ ok: false, error: "No hay pedidos pendientes de pago" });

    const amountInCents = pedidos.reduce((sum, p) => sum + Math.round(Number(p.precio) * 100), 0);
    if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
      return res.status(409).json({ ok: false, error: "El total del pedido no es válido" });
    }

    const reference = `GRUK_PEDIDO_${crypto.randomUUID()}`;
    await IntentoPagoPedido.create({
      reference,
      restaurantId,
      pedidoIds: pedidos.map(p => p._id),
      amountInCents,
      currency: "COP"
    });

    const signature = crypto.createHash("sha256")
      .update(`${reference}${amountInCents}COP${integrityKey}`)
      .digest("hex");

    return res.status(201).json({
      ok: true,
      publicKey,
      currency: "COP",
      amountInCents,
      reference,
      signature,
      redirectUrl: `${appUrl}/?restaurantId=${encodeURIComponent(restaurantId)}&mesa=${mesa}&pago=retorno`
    });
  } catch (error) {
    console.error("[PAGOS] Error creando pago de pedido:", error);
    return res.status(500).json({ ok: false, error: "No se pudo iniciar el pago" });
  }
});

module.exports = router;
