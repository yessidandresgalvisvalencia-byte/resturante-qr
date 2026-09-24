"use strict";

const cron = require("node-cron");
const Empresa = require("../../models/Empresa");
const { ejecutarCicloEmpresa } = require("../../intelligence/orchestrator/cicloInteligencia");

let iniciado = false;
let cicloEnCurso = false;

async function ejecutarCiclosActivos() {
  if (cicloEnCurso) return;
  cicloEnCurso = true;

  try {
    // INTELLIGENCE es parte estructural de GRUK, no un modulo opcional.
    const empresas = await Empresa.find({ estado: "activa" })
      .select("_id")
      .lean();

    for (const empresa of empresas) {
      try {
        await ejecutarCicloEmpresa(empresa._id, { forzarDecision: true });
      } catch (error) {
        console.error("[GRUK CEREBRO] ciclo empresa fallo", {
          empresaId: String(empresa._id),
          error: error.message
        });
      }
    }
  } catch (error) {
    console.error("[GRUK CEREBRO] job fallo", error);
  } finally {
    cicloEnCurso = false;
  }
}

function iniciarCerebroJob() {
  if (iniciado) return;
  iniciado = true;

  cron.schedule("0 */3 * * *", () => {
    void ejecutarCiclosActivos();
  });

  // Tras un despliegue no se obliga al dueño a esperar hasta el próximo bloque de 3 horas.
  setImmediate(() => {
    void ejecutarCiclosActivos();
  });
}

module.exports = iniciarCerebroJob;
module.exports.ejecutarCiclosActivos = ejecutarCiclosActivos;
