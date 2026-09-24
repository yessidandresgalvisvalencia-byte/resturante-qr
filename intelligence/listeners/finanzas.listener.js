"use strict";

const eventBus = require("../../core/eventos/eventBus");
const finanzasNeuron = require("../neurons/finanzas.neuron");
const { ejecutarCicloEmpresa } = require("../orchestrator/cicloInteligencia");

let registrado = false;
const empresasEnAnalisis = new Set();

function registrarFinanzasListener() {
  if (registrado) return;

  for (const eventName of finanzasNeuron.getRequiredEvents()) {
    eventBus.on(eventName, (event) => {
      const empresaId = event?.payload?.empresaId;

      if (!empresaId) {
        console.error("[GRUK INTELLIGENCE] evento financiero sin empresaId", {
          eventName
        });
        return;
      }

      const empresaKey = String(empresaId);
      if (empresasEnAnalisis.has(empresaKey)) return;

      empresasEnAnalisis.add(empresaKey);

      setImmediate(() => {
        Promise.resolve()
          .then(() => ejecutarCicloEmpresa(empresaId))
          .then((resultado) => {
            const reporte = resultado?.reportes?.find(
              (item) => item?.neurona === "FINANZAS"
            );

            console.log("[GRUK INTELLIGENCE] ciclo generado por evento financiero", {
              empresaId: empresaKey,
              reporteId: reporte?._id ? String(reporte._id) : null,
              estado: reporte?.kpi_principal?.estado || null,
              decisionId: resultado?.decision?._id
                ? String(resultado.decision._id)
                : null
            });
          })
          .catch((error) => {
            console.error("[GRUK INTELLIGENCE] ciclo financiero fallo aislado", {
              empresaId: empresaKey,
              error: error instanceof Error ? error.message : String(error)
            });
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
