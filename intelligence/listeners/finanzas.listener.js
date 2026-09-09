"use strict";

const eventBus = require("../../core/eventos/eventBus");
const finanzasNeuron = require("../neurons/finanzas.neuron");

let registrado = false;

function registrarFinanzasListener() {
  if (registrado) {
    return;
  }

  for (const eventName of finanzasNeuron.getRequiredEvents()) {
    eventBus.on(eventName, (event) => {
      const empresaId = event?.payload?.empresaId;

      if (!empresaId) {
        console.error(
          `[GRUK INTELLIGENCE] ${eventName} sin empresaId`
        );
        return;
      }

      // EventEmitter ejecuta listeners sincrónicamente.
      // Diferimos Inteligencia para sacarla de la ruta crítica
      // que confirma la venta.
      setImmediate(() => {
        Promise.resolve()
          .then(() => finanzasNeuron.analyze(empresaId))
          .then((reporte) => {
            console.log(
              "[GRUK INTELLIGENCE] FINANZAS reporte generado",
              {
                empresaId: String(empresaId),
                reporteId: reporte?._id
                  ? String(reporte._id)
                  : null,
                estado:
                  reporte?.kpi_principal?.estado || null
              }
            );
          })
          .catch((error) => {
            console.error(
              "[GRUK INTELLIGENCE] FINANZAS fallo aislado",
              {
                empresaId: String(empresaId),
                error:
                  error instanceof Error
                    ? error.message
                    : String(error)
              }
            );
          });
      });
    });
  }

  registrado = true;
}

module.exports = {
  registrarFinanzasListener
};
