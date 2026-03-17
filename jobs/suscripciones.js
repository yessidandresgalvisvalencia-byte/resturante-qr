const cron = require("node-cron");
const Restaurante = require("../models/restaurante");

function iniciarJobSuscripciones() {
  // Todos los días a las 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    try {
      console.log("Revisando suscripciones...");

      const hoy = new Date();

      const restaurantes = await Restaurante.find({
        estadoSuscripcion: "activa",
        fechaProximoCobro: { $lte: hoy }
      });

      for (const restaurante of restaurantes) {
        console.log(
          `Restaurante ${restaurante.nombreRestaurante} necesita cobro mensual`
        );

        // Aquí después vamos a poner el cobro real con Wompi
        // Por ahora solo dejamos el registro en consola
      }
    } catch (error) {
      console.log("Error en job de suscripciones:", error);
    }
  });
}

module.exports = iniciarJobSuscripciones;