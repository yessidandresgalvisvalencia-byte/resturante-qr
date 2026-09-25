"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEPARTAMENTOS_EXPERTOS,
  clasificarIntencion,
  detectarTemas,
  extraerHechosHumanos,
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


test("interpreta una venta humana concreta y la cruza con ticket real", async () => {
  const hechos = extraerHechosHumanos(
    "pero nos podemos guiar hoy hice una venta de mas de 100 mil pesos"
  );

  assert.equal(hechos.length, 1);
  assert.equal(hechos[0].tipo, "VENTA_REPORTADA");
  assert.equal(hechos[0].monto_cop, 100000);
  assert.equal(hechos[0].comparador, "MAYOR_QUE");
  assert.equal(hechos[0].momento, "HOY");

  const resultado = await generarRespuestasExpertas({
    pregunta:
      "pero nos podemos guiar hoy hice una venta de mas de 100 mil pesos",
    decision: null,
    reportes: [
      {
        neurona: "VENTAS",
        kpi_principal: {
          nombre: "ticket_promedio",
          valor_actual: 17141.43,
          valor_objetivo: null,
          estado: "ALERTA"
        },
        hallazgos: []
      },
      {
        neurona: "FINANZAS",
        kpi_principal: {
          nombre: "margen_bruto_confiable",
          valor_actual: null,
          valor_objetivo: null,
          estado: "ALERTA"
        },
        hallazgos: [
          {
            evidencia:
              "7 venta(s) no tienen costo congelado confiable.",
            confianza: 100
          }
        ]
      }
    ],
    intervenciones: []
  });

  const finanzas = resultado.respuestas.find(
    (item) => item.departamento === "FINANZAS"
  );
  const ventas = resultado.respuestas.find(
    (item) => item.departamento === "VENTAS"
  );
  const gente = resultado.respuestas.find(
    (item) => item.departamento === "GENTE"
  );
  const direccion = resultado.respuestas.find(
    (item) => item.departamento === "DIRECCION"
  );

  assert.match(finanzas.respuesta, /5\.8 veces/i);
  assert.match(finanzas.respuesta, /venta, cobro y margen/i);
  assert.match(ventas.respuesta, /por qué ese cliente compró tanto/i);
  assert.match(gente.respuesta, /no me da evidencia para contratar/i);
  assert.match(direccion.respuesta, /qué hizo posible esta venta/i);

  assert.ok(
    ventas.evidencia_usada.some(
      (item) => /DATO_USUARIO/.test(item)
    )
  );
  assert.ok(
    ventas.evidencia_usada.some(
      (item) => /17\.141/.test(item)
    )
  );
});
