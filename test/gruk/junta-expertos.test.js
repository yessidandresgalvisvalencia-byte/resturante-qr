"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEPARTAMENTOS_EXPERTOS,
  clasificarIntencion,
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

test("la Junta fallback conserva seis expertos y orden canónico", async () => {
  const resultado = await generarRespuestasExpertas({
    pregunta:
      "Empezando desde cero, ¿cómo crearíamos el flujo de caja?",
    decision: null,
    reportes: [],
    intervenciones: [],
    proveedor: async () => null
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
  assert.ok(finanzas.riesgos.length > 0);
  assert.ok(finanzas.confianza > 0);
});

test("la intención de corrección tiene prioridad sobre consulta genérica", () => {
  assert.equal(
    clasificarIntencion(
      "Eso no es correcto, corrige el análisis"
    ),
    "CORRECCION"
  );
});

test("el contexto enviado al proveedor minimiza identificadores internos", () => {
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
      ordenes_por_departamento: [
        {
          _id: "orden-secreta",
          departamento: "FINANZAS",
          tarea: "Revisar caja",
          prioridad: "ALTA",
          kpi_a_medir: "caja",
          estado: "PENDIENTE_APROBACION",
          responsableId: "usuario-secreto"
        }
      ],
      confianza_global: 70
    },
    reportes: [
      {
        _id: "reporte-secreto",
        neurona: "FINANZAS",
        periodo: {
          desde: "2026-09-01",
          hasta: "2026-09-30"
        },
        kpi_principal: {
          nombre: "caja",
          valor_actual: 10,
          valor_objetivo: 20,
          estado: "ALERTA"
        },
        hallazgos: []
      }
    ],
    intervenciones: [
      {
        _id: "intervencion-secreta",
        tipo: "HUMANO",
        departamento: "DIRECCION",
        mensaje: "Necesitamos entender la caja"
      }
    ]
  });

  const serializado = JSON.stringify(contexto);

  assert.doesNotMatch(serializado, /decision-secreta/);
  assert.doesNotMatch(serializado, /orden-secreta/);
  assert.doesNotMatch(serializado, /usuario-secreto/);
  assert.doesNotMatch(serializado, /reporte-secreto/);
  assert.doesNotMatch(serializado, /intervencion-secreta/);
  assert.match(serializado, /Caja presionada/);
});

test("rechaza respuestas duplicadas o incompletas del proveedor", () => {
  const respuestas = DEPARTAMENTOS_EXPERTOS.map(
    respuestaValida
  );

  respuestas[5] = respuestaValida("FINANZAS");

  assert.throws(
    () => validarRespuestas(respuestas),
    /JUNTA_IA_RESPUESTAS_INCOMPLETAS/
  );
});

test("normaliza el resultado del proveedor al orden de la Junta", async () => {
  const generadas = DEPARTAMENTOS_EXPERTOS
    .map(respuestaValida)
    .reverse();

  const resultado = await generarRespuestasExpertas({
    pregunta: "¿Qué debemos revisar primero?",
    decision: null,
    reportes: [],
    intervenciones: [],
    proveedor: async ({ contexto }) => {
      assert.equal(
        contexto.pregunta_humana,
        "¿Qué debemos revisar primero?"
      );

      return {
        model: "modelo-prueba",
        responseId: "resp_prueba",
        parsed: {
          respuestas: generadas
        }
      };
    }
  });

  assert.equal(resultado.model, "modelo-prueba");
  assert.equal(resultado.responseId, "resp_prueba");
  assert.deepEqual(
    resultado.respuestas.map((item) => item.departamento),
    DEPARTAMENTOS_EXPERTOS
  );
});
