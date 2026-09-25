"use strict";

const DEPARTAMENTOS_EXPERTOS = Object.freeze([
  "FINANZAS","VENTAS","MARKETING","OPERACIONES","GENTE","DIRECCION"
]);

const CONOCIMIENTO = Object.freeze({
  FINANZAS: {
    foco: "caja, margen, costos, rentabilidad, punto de equilibrio y riesgo financiero",
    reglas: ["MARGEN_BAJO_OBJETIVO","COSTO_NO_CONFIABLE"]
  },
  VENTAS: {
    foco: "ticket, mezcla, conversion, recurrencia y calidad de ingresos",
    reglas: ["TICKET_BAJO_OBJETIVO"]
  },
  MARKETING: {
    foco: "CAC, atribucion, demanda y eficiencia de adquisicion",
    reglas: ["DATOS_INSUFICIENTES"]
  },
  OPERACIONES: {
    foco: "inventario, merma, abastecimiento, capacidad y continuidad",
    reglas: ["INVENTARIO_AGOTADO","SIN_INVENTARIO_CONFIGURADO"]
  },
  GENTE: {
    foco: "dotacion, roles, carga operativa y riesgos de personas",
    reglas: ["CONFIGURACION_INCOMPLETA"]
  },
  DIRECCION: {
    foco: "prioridades, dependencias, gobierno y trade-offs entre funciones",
    reglas: []
  }
});

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function evidenciaReporte(reporte) {
  return (reporte?.hallazgos || [])
    .map((h) => String(h.evidencia || "").trim())
    .filter(Boolean);
}

function hechosReporte(reporte) {
  if (!reporte) return [];
  const kpi = reporte.kpi_principal || {};
  const hechos = [
    `${reporte.neurona}: ${kpi.nombre || "KPI"} está en ${kpi.estado || "SIN_ESTADO"}.`
  ];
  if (numero(kpi.valor_actual) !== null) hechos.push(`Valor actual: ${numero(kpi.valor_actual)}.`);
  if (numero(kpi.valor_objetivo) !== null) hechos.push(`Objetivo: ${numero(kpi.valor_objetivo)}.`);
  return hechos.concat(evidenciaReporte(reporte));
}

function respuestaFuncion(departamento, reporte, pregunta, memoriaHumana) {
  const hechos = hechosReporte(reporte);
  const hallazgos = reporte?.hallazgos || [];
  const tipos = hallazgos.map((h) => h.tipo).filter(Boolean);
  const relevantes = tipos.filter((t) => CONOCIMIENTO[departamento].reglas.includes(t));
  const faltantes = [];

  if (!reporte) faltantes.push(`No existe reporte vigente de ${departamento}.`);
  if (departamento === "MARKETING" && tipos.includes("DATOS_INSUFICIENTES")) {
    faltantes.push("Falta atribución suficiente para calcular CAC de forma confiable.");
  }
  if (departamento === "FINANZAS" && tipos.includes("COSTO_NO_CONFIABLE")) {
    faltantes.push("Faltan costos congelados confiables para parte de las ventas.");
  }
  if (departamento === "OPERACIONES" && tipos.includes("SIN_INVENTARIO_CONFIGURADO")) {
    faltantes.push("Falta inventario configurado para medir agotados y continuidad.");
  }

  let criterio = `${departamento}: revisé la pregunta desde ${CONOCIMIENTO[departamento].foco}.`;
  if (relevantes.length) {
    criterio += ` Los datos actuales muestran ${relevantes.join(", ")}; debe corregirse o medirse antes de asumir una mejora.`;
  } else if (reporte) {
    criterio += " El reporte disponible no contiene un hallazgo determinístico específico de esta función que permita afirmar una causa adicional.";
  } else {
    criterio += " No hay datos suficientes para emitir una conclusión empresarial de esta función.";
  }

  if (memoriaHumana.length) {
    criterio += " También existe criterio humano previo de esta empresa; se conserva como contexto, no como hecho ni como regla global.";
  }

  return {
    departamento,
    respuesta: criterio,
    evidencia_usada: hechos,
    inferencias: relevantes.length
      ? [`La prioridad profesional de ${departamento} debe centrarse en los hallazgos determinísticos indicados antes de ampliar conclusiones.`]
      : [],
    datos_faltantes: faltantes
  };
}

function extraerMemoriaHumana(intervenciones) {
  return (intervenciones || [])
    .filter((i) => i.tipo === "HUMANO")
    .slice(-10)
    .map((i) => String(i.mensaje || "").trim())
    .filter(Boolean);
}

async function generarRespuestasExpertas({ pregunta, reportes, intervenciones }) {
  const porNeurona = new Map((reportes || []).map((r) => [r.neurona, r]));
  const memoriaHumana = extraerMemoriaHumana(intervenciones);

  const respuestas = DEPARTAMENTOS_EXPERTOS
    .filter((d) => d !== "DIRECCION")
    .map((departamento) =>
      respuestaFuncion(
        departamento,
        porNeurona.get(departamento) || null,
        pregunta,
        memoriaHumana
      )
    );

  const alertas = respuestas
    .filter((r) => r.evidencia_usada.length || r.datos_faltantes.length)
    .map((r) => r.departamento);

  respuestas.push({
    departamento: "DIRECCION",
    respuesta:
      "DIRECCION: la Junta completa revisó la pregunta. " +
      (alertas.length
        ? `Hay evidencia o datos faltantes que requieren atención en: ${alertas.join(", ")}. `
        : "No hay evidencia suficiente para elevar una causa nueva. ") +
      "Dirección sintetiza; no reemplaza al Cerebro ni emite órdenes.",
    evidencia_usada: respuestas.flatMap((r) => r.evidencia_usada).slice(0, 20),
    inferencias: ["Las decisiones deben conservar trazabilidad hacia los reportes determinísticos y las correcciones humanas."],
    datos_faltantes: respuestas.flatMap((r) => r.datos_faltantes)
  });

  return {
    model: "GRUK-DETERMINISTICO-1",
    responseId: null,
    respuestas
  };
}

module.exports = {
  DEPARTAMENTOS_EXPERTOS,
  CONOCIMIENTO,
  generarRespuestasExpertas,
  extraerMemoriaHumana
};
