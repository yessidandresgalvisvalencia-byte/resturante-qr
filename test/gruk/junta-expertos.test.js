"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEPARTAMENTOS_EXPERTOS,
  clasificarIntencion,
  detectarTemas,
  construirContexto,
  validarRespuestas,
  generarRespuestasExpertas
} = require("../../intelligence/board/expertos.service");

function respuestaValida(departamento) {
  return {
    departamento,
    respuesta: `Respuesta de ${departamento}`,
    criterio_profesional: `Criterio de ${departamento}`,
    evidencia_usada: [],
    inferencias: [],
    riesgos: [],
    objeciones: [],
    acuerdos: [],
    datos_faltantes: [],
    confianza: 80
  };
}

test("la Junta nativa conserva seis expertos y orden canónico", async () => {
  const resultado = await generarRespuestasExpertas({
    pregunta:
      "Empezando desde cero, ¿cómo crearíamos el flujo de caja?",
    decision: null,
    reportes: [],
    intervenciones: []
  });

  assert.equal(resultado.intencion, "ARRANQUE");
  assert.equal(resultado.respuestas.length, 6);
  assert.deepEqual(
    resultado.respuestas.map((item) => item.departamento),
    DEPARTAMENTOS_EXPERTOS
  );

  const finanzas = resultado.respuestas.find(
    (item) => item.departamento === "FINANZAS"
  );

  assert.match(finanzas.respuesta, /caja/i);
  assert.ok(finanzas.criterio_profesional);
  assert.ok(finanzas.datos_faltantes.length > 0);
  assert.ok(finanzas.confianza > 0);
});

test("detecta caja y margen sin proveedor externo", () => {
  const temas = detectarTemas(
    "¿Cómo cuidamos flujo de caja y margen?"
  );

  assert.ok(temas.includes("FLUJO_CAJA"));
  assert.ok(temas.includes("MARGEN_PRECIO"));
});

test("la intención de corrección tiene prioridad sobre consulta genérica", () => {
  assert.equal(
    clasificarIntencion(
      "Eso no es correcto, corrige el análisis"
    ),
    "CORRECCION"
  );
});

test("el contexto interno minimiza identificadores no necesarios", () => {
  const contexto = construirContexto({
    pregunta: "¿Qué opinan?",
    intencion: "CONSULTA",
    decision: {
      _id: "decision-secreta",
      decision_general: {
        situacion: "Caja presionada",
        causa_raiz: "Causa aún en discusión",
        prediccion: "Requiere seguimiento"
      },
      confianza_global: 70
    },
    reportes: [{
      _id: "reporte-secreto",
      neurona: "FINANZAS",
      kpi_principal: {
        nombre: "caja",
        valor_actual: 10,
        valor_objetivo: 20,
        estado: "ALERTA"
      },
      hallazgos: []
    }],
    intervenciones: [{
      _id: "intervencion-secreta",
      tipo: "HUMANO",
      departamento: "DIRECCION",
      mensaje: "Necesitamos entender la caja"
    }]
  });

  const serializado = JSON.stringify(contexto);

  assert.doesNotMatch(serializado, /decision-secreta/);
  assert.doesNotMatch(serializado, /reporte-secreto/);
  assert.doesNotMatch(serializado, /intervencion-secreta/);
  assert.match(serializado, /Caja presionada/);
});

test("rechaza respuestas duplicadas o incompletas", () => {
  const respuestas = DEPARTAMENTOS_EXPERTOS.map(
    respuestaValida
  );

  respuestas[5] = respuestaValida("FINANZAS");

  assert.throws(
    () => validarRespuestas(respuestas),
    /JUNTA_RESPUESTAS_INCOMPLETAS/
  );
});

test("Finanzas y Ventas se objetan sobre caja", async () => {
  const resultado = await generarRespuestasExpertas({
    pregunta:
      "¿Cómo organizamos el flujo de caja para no morir?",
    decision: null,
    reportes: [],
    intervenciones: []
  });

  const finanzas = resultado.respuestas.find(
    (item) => item.departamento === "FINANZAS"
  );
  const ventas = resultado.respuestas.find(
    (item) => item.departamento === "VENTAS"
  );

  assert.ok(
    finanzas.objeciones.some((item) => /VENTAS/.test(item))
  );
  assert.ok(
    ventas.objeciones.some((item) => /FINANZAS/.test(item))
  );
});
