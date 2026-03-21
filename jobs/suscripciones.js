const cron = require("node-cron");
const axios = require("axios");
const Restaurante = require("../models/restaurante");

function iniciarJobSuscripciones() {
  // 🔁 se ejecuta todos los días a las 9am
  cron.schedule("0 9 * * *", async () => {
    try {
      console.log("🔁 Revisando suscripciones...");

      const hoy = new Date();

      const restaurantes = await Restaurante.find({
        estadoSuscripcion: "activa",
        fechaProximoCobro: { $lte: hoy },
        paymentSourceId: { $ne: "" }
      });

      console.log("Restaurantes a cobrar:", restaurantes.length);

      for (const restaurante of restaurantes) {
        try {
          const amountInCents = restaurante.precioMensual * 100;
          const currency = "COP";
          const reference = `renovacion_${restaurante.restaurantId}_${Date.now()}`;

          const merchantRes = await axios.get(
            `https://sandbox.wompi.co/v1/merchants/${process.env.WOMPI_PUBLIC_KEY}`
          );

          const acceptanceToken =
            merchantRes.data?.data?.presigned_acceptance?.acceptance_token;

          const txRes = await axios.post(
            "https://sandbox.wompi.co/v1/transactions",
            {
              acceptance_token: acceptanceToken,
              amount_in_cents: amountInCents,
              currency,
              customer_email: restaurante.customerEmailWompi || restaurante.correo,
              reference,
              payment_source_id: Number(restaurante.paymentSourceId)
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
                "Content-Type": "application/json"
              }
            }
          );

          console.log("💰 Cobro enviado:", restaurante.restaurantId);

        } catch (error) {
          console.log(
            "❌ Error cobrando:",
            restaurante.restaurantId,
            error?.response?.data || error
          );

          // 👉 si falla, lo pasamos a pendiente
          restaurante.estadoSuscripcion = "pendiente";
          await restaurante.save();
        }
      }

    } catch (error) {
      console.log("❌ Error general del job:", error);
    }
  });
}

module.exports = iniciarJobSuscripciones;