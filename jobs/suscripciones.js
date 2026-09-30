"use strict";

const cron = require("node-cron");
const axios = require("axios");
const Restaurante = require("../models/restaurante");
const { obtenerOCrearIntento, adquirirDerechoEnvio } = require("../core/pagos/intentoCobro.service");
const IntentoCobroSuscripcion = require("../models/IntentoCobroSuscripcion");

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
          const intento = await obtenerOCrearIntento({ restaurante, amountInCents, currency });
          if (["ENVIANDO","ENVIADO","PENDIENTE","APROBADO","RESULTADO_DESCONOCIDO"].includes(intento.estado) || intento.transactionId) {
            console.log("Cobro mensual ya iniciado:", restaurante.restaurantId, intento.periodo);
            continue;
          }
          const intentoAdquirido = await adquirirDerechoEnvio(intento._id);
          if (!intentoAdquirido) {
            console.log("Otro worker adquirió el cobro mensual:", restaurante.restaurantId, intento.periodo);
            continue;
          }
          const reference = intentoAdquirido.reference;

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

          const tx = txRes?.data?.data;
          const estadoFinal = String(tx?.status || "").toUpperCase() === "APPROVED" ? "APROBADO" : "PENDIENTE";
          const actualizado = await IntentoCobroSuscripcion.findOneAndUpdate(
            {_id:intentoAdquirido._id,estado:"ENVIANDO"},
            {$set:{transactionId:String(tx?.id || ""),estado:estadoFinal,enviadoAt:new Date(),...(estadoFinal==="APROBADO"?{resueltoAt:new Date()}:{})}},
            {new:true}
          );
          console.log("Cobro automático enviado para:", restaurante.restaurantId, actualizado?.transactionId || "sin id");
        } catch (error) {
          try {
            const intentoFallido = await IntentoCobroSuscripcion.findOne({ restaurantId: restaurante.restaurantId, periodo: new Date().toISOString().slice(0,7) });
            if (intentoFallido && intentoFallido.estado === "ENVIANDO") {
              intentoFallido.estado = "RESULTADO_DESCONOCIDO";
              intentoFallido.ultimoError = "Resultado remoto no confirmado; reintento automático bloqueado";
              await intentoFallido.save();
            }
          } catch (ledgerError) { console.error("Error cerrando intento incierto:", ledgerError.message); }
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
