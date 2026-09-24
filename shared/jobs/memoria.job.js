"use strict";

const cron = require("node-cron");
const {
  evaluarPendientes
} = require("../../intelligence/memory/memoria.service");

let iniciado = false;
let enCurso = false;

async function ejecutarMemoriaPendiente() {
  if (enCurso) return [];
  enCurso = true;

  try {
    return await evaluarPendientes(new Date());
  } catch (error) {
    console.error("[GRUK MEMORIA] job fallo", error);
    return [];
  } finally {
    enCurso = false;
  }
}

function iniciarMemoriaJob() {
  if (iniciado) return;
  iniciado = true;

  cron.schedule("45 */3 * * *", () => {
    void ejecutarMemoriaPendiente();
  });

  setImmediate(() => {
    void ejecutarMemoriaPendiente();
  });
}

module.exports = iniciarMemoriaJob;
module.exports.ejecutarMemoriaPendiente = ejecutarMemoriaPendiente;
