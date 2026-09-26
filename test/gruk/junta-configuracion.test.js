"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generarRespuestasExpertas
} = require(
  "../../intelligence/board/expertos.service"
);

function reporte({
  neurona,
  nombre,
  estado,
  evaluabilidad,
  valorActual = null,
  valorObjetivo = null,
  medicionDisponible = true,
  objetivoDisponible = true,
  motivo = ""
}) {
  return {
    neurona,
    kpi_principal: {
      nombre,
      estado,
      evaluabilidad,
      valor_actual: valorActual,
      valor_objetivo: valorObjetivo,
      medicion_disponible:
        medicionDisponible,
      objetivo_disponible:
        objetivoDisponible,
      motivo_no_evaluable:
        motivo
    },
    hallazgos: [
      {
        tipo:
          evaluabilidad ===
          "SIN_CONFIGURAR"
            ? "CONFIGURACION_INCOMPLETA"
            : "DATOS_INSUFICIENTES",
        evidencia:
          motivo ||
          "Dato pendiente.",
        impacto_financiero_estimado:
          0,
        confianza:
          100
      }
    ]
  };
}

test("junta general consolida configuracion pendiente como una sola brecha", async () => {
  const reportes = [
    reporte({
      neurona: "FINANZAS",
      nombre:
        "margen_bruto_confiable",
      estado:
        "SIN_CONFIGURAR",
      evaluabilidad:
        "SIN_CONFIGURAR",
      valorActual:
        86.34,
      valorObjetivo:
        null,
      objetivoDisponible:
        false,
      motivo:
        "Falta configurar margen objetivo."
    }),
    reporte({
      neurona: "VENTAS",
      nombre:
        "ticket_promedio",
      estado:
        "SIN_CONFIGURAR",
      evaluabilidad:
        "SIN_CONFIGURAR",
      valorActual:
        23746.88,
      valorObjetivo:
        null,
      objetivoDisponible:
        false,
      motivo:
        "Falta configurar ticket objetivo."
    }),
    reporte({
      neurona: "MARKETING",
      nombre:
        "cac",
      estado:
        "SIN_CONFIGURAR",
      evaluabilidad:
        "SIN_CONFIGURAR",
      medicionDisponible:
        false,
      objetivoDisponible:
        false,
      motivo:
        "Falta configurar CAC maximo."
    }),
    reporte({
      neurona: "OPERACIONES",
      nombre:
        "porcentaje_items_agotados",
      estado:
        "DATOS_INSUFICIENTES",
      evaluabilidad:
        "DATOS_INSUFICIENTES",
      medicionDisponible:
        false,
      valorObjetivo:
        0,
      motivo:
        "No existen items activos de inventario."
    }),
    reporte({
      neurona: "GENTE",
      nombre:
        "empleados_actuales",
      estado:
        "SIN_CONFIGURAR",
      evaluabilidad:
        "SIN_CONFIGURAR",
      medicionDisponible:
        false,
      objetivoDisponible:
        false,
      motivo:
        "Falta configurar empleados actuales."
    })
  ];

  const resultado =
    await generarRespuestasExpertas({
      pregunta:
        "¿Cómo va la empresa hoy?",
      decision:
        null,
      reportes,
      intervenciones:
        []
    });

  const direccion =
    resultado.respuestas.find(
      (item) =>
        item.departamento ===
        "DIRECCION"
    );

  assert.ok(direccion);

  assert.match(
    direccion.respuesta,
    /una sola brecha de preparación de GRUK/i
  );

  assert.match(
    direccion.respuesta,
    /margen objetivo/i
  );

  assert.match(
    direccion.respuesta,
    /ticket objetivo/i
  );

  assert.match(
    direccion.respuesta,
    /CAC máximo/i
  );

  assert.match(
    direccion.respuesta,
    /empleados actuales/i
  );

  assert.match(
    direccion.respuesta,
    /ausencia de evidencia, no una alerta del negocio/i
  );

  const funcionesOcultas =
    resultado.respuestas
      .filter(
        (item) =>
          item.departamento !==
          "DIRECCION"
      )
      .filter(
        (item) =>
          item.relevancia ===
          "NINGUNA"
      )
      .map(
        (item) =>
          item.departamento
      );

  assert.deepEqual(
    funcionesOcultas.sort(),
    [
      "FINANZAS",
      "GENTE",
      "MARKETING",
      "OPERACIONES",
      "VENTAS"
    ].sort()
  );

  const texto =
    resultado.respuestas
      .map(
        (item) =>
          item.respuesta
      )
      .join(" ");

  assert.doesNotMatch(
    texto,
    /KPI disponible está ALERTA/i
  );
});

test("pregunta explicita de margen permite a Finanzas declarar limite sin falsa alerta", async () => {
  const resultado =
    await generarRespuestasExpertas({
      pregunta:
        "¿Cómo está mi margen y qué debería revisar?",
      decision:
        null,
      reportes: [
        reporte({
          neurona:
            "FINANZAS",
          nombre:
            "margen_bruto_confiable",
          estado:
            "SIN_CONFIGURAR",
          evaluabilidad:
            "SIN_CONFIGURAR",
          valorActual:
            40,
          objetivoDisponible:
            false,
          motivo:
            "Falta configurar margen objetivo."
        })
      ],
      intervenciones:
        []
    });

  const finanzas =
    resultado.respuestas.find(
      (item) =>
        item.departamento ===
        "FINANZAS"
    );

  assert.notEqual(
    finanzas.relevancia,
    "NINGUNA"
  );

  assert.match(
    finanzas.respuesta,
    /No voy a diagnosticar margen_bruto_confiable todavía/i
  );

  assert.match(
    finanzas.respuesta,
    /no una falla del negocio/i
  );

  assert.doesNotMatch(
    finanzas.respuesta,
    /estado ALERTA/i
  );
});
