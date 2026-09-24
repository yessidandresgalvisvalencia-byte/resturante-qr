"use strict";

const cron = require("node-cron");
const axios = require("axios");
const Restaurante = require("../models/restaurante");

function iniciarJobSuscripciones() {
  cron.schedule("0 9 * * *", async () => {
    try {
      console.log("Revisando suscripciones automáticas...");

      const hoy = new Date();
      const wompiPrivateKey = process.env.WOMPI_PRIVATE_KEY;
      const wompiPublicKeyGlobal = process.env.WOMPI_PUBLIC_KEY;

      if (!wompiPrivateKey) {
        console.error("[SEGURIDAD] WOMPI_PRIVATE_KEY no configurada; se omite cobro automático");
        return;
      }

      const restaurantes = await Restaurante.find({
        estadoSuscripcion: "activa",
        fechaProximoCobro: { $lte: hoy },
        paymentSourceId: { $ne: "" },
        tokenizacionCompleta: true
      });

      console.log("Restaurantes para cobrar:", restaurantes.length);

      for (const restaurante of restaurantes) {
        try {
          const wompiPublicKey =
            restaurante.wompiPublicKey || wompiPublicKeyGlobal;

          if (!wompiPublicKey) {
            console.log("Falta llave pública Wompi para restaurante:", restaurante.restaurantId);
            continue;
          }

          const amountInCents = Number(restaurante.precioMensual || 0) * 100;
          if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
            console.error("Precio mensual inválido:", restaurante.restaurantId);
            continue;
          }

          const currency = "COP";
          const reference = `renovacion_${restaurante.restaurantId}_${Date.now()}`;

          const merchantRes = await axios.get(
            `https://production.wompi.co/v1/merchants/${wompiPublicKey}`
          );

          const acceptanceToken =
            merchantRes?.data?.data?.presigned_acceptance?.acceptance_token;

          if (!acceptanceToken) {
            console.log("No se pudo obtener acceptance token para:", restaurante.restaurantId);
            continue;
          }

          const txRes = await axios.post(
            "https://production.wompi.co/v1/transactions",
            {
              acceptance_token: acceptanceToken,
              amount_in_cents: amountInCents,
              currency,
              customer_email: restaurante.customerEmailWompi,
              reference,
              payment_source_id: Number(restaurante.paymentSourceId)
            },
            {
              headers: {
                Authorization: `Bearer ${wompiPrivateKey}`,
                "Content-Type": "application/json"
              }
            }
          );

          console.log(
            "Cobro automático enviado para:",
            restaurante.restaurantId,
            txRes?.data?.data?.id || "sin id"
          );
        } catch (error) {
          console.log(
            "Error cobrando automáticamente a",
            restaurante.restaurantId,
            error?.response?.data || error?.message || error
          );
        }
      }
    } catch (error) {
      console.log("Error general del job de suscripciones:", error?.message || error);
    }
  });
}

module.exports = iniciarJobSuscripciones;
