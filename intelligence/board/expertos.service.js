"use strict";

const DEPARTAMENTOS_EXPERTOS = Object.freeze([
  "FINANZAS","VENTAS","MARKETING","OPERACIONES","GENTE","DIRECCION"
]);

const CONOCIMIENTO = Object.freeze({
  FINANZAS: {
    foco: "caja, margen, costos, rentabilidad, punto de equilibrio y riesgo financiero",
    arranque: "Definir inversión disponible, costos fijos y variables, margen objetivo, punto de equilibrio, política de caja y control semanal."
  },
  VENTAS: {
    foco: "cliente, oferta, ticket, conversión, recurrencia y calidad de ingresos",
    arranque: "Definir qué se vende, a quién, ticket objetivo, proceso comercial, meta de ventas y cómo se registrará cada venta."
  },
  MARKETING: {
    foco: "cliente objetivo, propuesta de valor, demanda, canales, CAC y atribución",
    arranque: "Definir cliente ideal, propuesta de valor, canal inicial, presupuesto máximo de adquisición y atribución desde la primera campaña."
  },
  OPERACIONES: {
    foco: "capacidad, abastecimiento, inventario, merma, calidad y continuidad",
    arranque: "Diseñar el flujo de entrega, capacidad, proveedores, inventario mínimo, controles de merma y responsables operativos."
  },
  GENTE: {
    foco: "responsabilidades, dotación, carga, productividad y riesgos de personas",
    arranque: "Asignar responsable y KPI a Dirección, Operaciones, Ventas, Finanzas y Marketing; separar Gente cuando la escala lo justifique."
  },
  DIRECCION: {
    foco: "prioridades, dependencias, gobierno y secuencia de ejecución",
    arranque: "Ordenar las definiciones anteriores, cerrar datos críticos faltantes y convertirlas en un plan medible antes de emitir órdenes."
  }
});

function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function clasificarIntencion(pregunta) {
  const p = normalizar(pregunta);
  if (/(desde cero|empezar de cero|comenzar de cero|crear empresa|montar empresa|arrancar)/.test(p)) return "ARRANQUE";
  if (/(corrige|corregir|equivoc|eso no|no es correcto|error)/.test(p)) return "CORRECCION";
  if (/(que significa|por que|explica|entender)/.test(p)) return "EXPLICACION";
  if (/(que hacemos|que hago|como mejor|prioridad|primero)/.test(p)) return "ACCION";
  return "CONSULTA";
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function formato(valor) {
  const n = numero(valor);
  if (n === null) return null;
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(n);
}

function hechosReporte(reporte) {
  if (!reporte) return [];
  const kpi = reporte.kpi_principal || {};
  const hechos = [`${reporte.neurona}: ${kpi.nombre || "KPI"} — estado ${kpi.estado || "SIN_ESTADO"}.`];
  const actual = formato(kpi.valor_actual);
  const objetivo = formato(kpi.valor_objetivo);
  if (actual !== null) hechos.push(`Valor actual: ${actual}.`);
  if (objetivo !== null) hechos.push(`Objetivo: ${objetivo}.`);
  return hechos.concat((reporte.hallazgos || []).map(h => String(h.evidencia || "").trim()).filter(Boolean));
}

function memoriaHumana(intervenciones) {
  return (intervenciones || [])
    .filter(i => i.tipo === "HUMANO")
    .slice(-10)
    .map(i => String(i.mensaje || "").trim())
    .filter(Boolean);
}

function responderArranque(departamento) {
  return {
    departamento,
    respuesta: `${departamento}: si el escenario es empezar desde cero, mi responsabilidad es ${CONOCIMIENTO[departamento].foco}. ${CONOCIMIENTO[departamento].arranque}`,
    evidencia_usada: [],
    inferencias: ["Este es criterio empresarial de diseño para un escenario hipotético; no describe el estado histórico de la empresa."],
    datos_faltantes: []
  };
}

function responderContexto(departamento, reporte, intencion, memoria) {
  const hechos = hechosReporte(reporte);
  const faltantes = [];
  if (!reporte) faltantes.push(`No hay reporte vigente de ${departamento}.`);

  let respuesta = `${departamento}: para esta consulta revisaría ${CONOCIMIENTO[departamento].foco}.`;
  if (reporte) {
    respuesta += ` El KPI disponible está ${reporte.kpi_principal?.estado || "sin estado"}; los hallazgos siguientes son la evidencia disponible, no una explicación automática de la causa.`;
  } else {
    respuesta += " No hay evidencia suficiente para afirmar una causa concreta.";
  }
  if (memoria.length) {
    respuesta += " Hay intervenciones humanas previas, pero no se convierten automáticamente en hechos ni reglas.";
  }
  return { departamento, respuesta, evidencia_usada: hechos, inferencias: [], datos_faltantes: faltantes };
}

async function generarRespuestasExpertas({ pregunta, reportes, intervenciones }) {
  const intencion = clasificarIntencion(pregunta);
  const porNeurona = new Map((reportes || []).map(r => [r.neurona, r]));
  const memoria = memoriaHumana(intervenciones);

  const funcionales = DEPARTAMENTOS_EXPERTOS.filter(d => d !== "DIRECCION").map(departamento =>
    intencion === "ARRANQUE"
      ? responderArranque(departamento)
      : responderContexto(departamento, porNeurona.get(departamento) || null, intencion, memoria)
  );

  const faltantes = funcionales.flatMap(r => r.datos_faltantes);
  const direccion = intencion === "ARRANQUE"
    ? {
        departamento: "DIRECCION",
        respuesta: "DIRECCION: empezando desde cero, no conviene arrancar por departamentos ni por software. Primero definimos cliente y oferta; después economía unitaria y caja; luego operación; asignamos responsable y KPI a las cinco funciones críticas; y finalmente configuramos GRUK para medirlas. El siguiente paso es que el humano aporte las decisiones básicas que todavía no existen.",
        evidencia_usada: [],
        inferencias: ["Secuencia de diseño empresarial; no utiliza las ventas históricas porque la pregunta planteó explícitamente un escenario desde cero."],
        datos_faltantes: ["Qué negocio se va a crear.", "Qué se venderá y a qué cliente.", "Capital disponible.", "Ubicación o canal de operación.", "Número inicial de personas."]
      }
    : {
        departamento: "DIRECCION",
        respuesta: "DIRECCION: consolidé las cinco perspectivas. Los datos disponibles sirven como evidencia, pero no sustituyen la pregunta ni prueban por sí solos una causa. Antes de convertir la discusión en una decisión deben resolverse los datos faltantes relevantes.",
        evidencia_usada: funcionales.flatMap(r => r.evidencia_usada).slice(0,20),
        inferencias: ["La síntesis conserva separación entre hechos, criterio profesional y datos faltantes."],
        datos_faltantes: faltantes
      };

  return { model: "GRUK-CONSULTIVO-2", responseId: null, intencion, respuestas: [...funcionales, direccion] };
}

module.exports = { DEPARTAMENTOS_EXPERTOS, CONOCIMIENTO, clasificarIntencion, generarRespuestasExpertas, extraerMemoriaHumana: memoriaHumana };
