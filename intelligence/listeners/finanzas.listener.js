"use strict";

const eventBus = require("../../core/eventos/eventBus");
const finanzasNeuron = require("../neurons/finanzas.neuron");
const { ejecutarCicloEmpresa } = require("../orchestrator/cicloInteligencia");

let registrado = false;
const empresasEnAnalisis = new Set();

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

      const empresaKey = String(empresaId);

      if (empresasEnAnalisis.has(empresaKey)) {
        return;
      }

      empresasEnAnalisis.add(empresaKey);

      // EventEmitter ejecuta listeners sincrónicamente.
      // Inteligencia queda fuera de la ruta crítica de la venta.
      setImmediate(() => {
        Promise.resolve()
          .then(() => finanzasNeuron.analyze(empresaId))
          .then(async (reporte) => {
            console.log(
              "[GRUK INTELLIGENCE] FINANZAS reporte generado",
              {
                empresaId: empresaKey,
                reporteId: reporte?._id
                  ? String(reporte._id)
                  : null,
                estado:
                  reporte?.kpi_principal?.estado || null
              }
            );

            if (reporte?.kpi_principal?.estado === "CRITICO") {
              await ejecutarCicloEmpresa(empresaId);
            }
          })
          .catch((error) => {
            console.error(
              "[GRUK INTELLIGENCE] FINANZAS fallo aislado",
              {
                empresaId: empresaKey,
                error:
                  error instanceof Error
                    ? error.message
                    : String(error)
              }
            );
          })
          .finally(() => {
            empresasEnAnalisis.delete(empresaKey);
          });
      });
    });
  }

  registrado = true;
}

module.exports = {
  registrarFinanzasListener
};
