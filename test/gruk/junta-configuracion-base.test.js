"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  evaluabilidadReporte,
  hechosReporte,
  generarRespuestasExpertas
} = require(
  "../../intelligence/board/expertos.service"
);

const {
  diagnosticosExpertosObsoletos
} = require(
  "../../intelligence/board/juntaViva.service"
);

function reporte(
  neurona,
  nombre,
  evaluabilidad,
  {
    valorActual = null,
    valorObjetivo = null,
    medicionDisponible = false,
    objetivoDisponible = false,
    motivo = "Configuración pendiente."
  } = {}
) {
  return {
    neurona,
    kpi_principal: {
      nombre,
      valor_actual:
        valorActual,
      valor_objetivo:
        valorObjetivo,
      estado:
        "ALERTA",
      medicion_disponible:
        medicionDisponible,
      objetivo_disponible:
        objetivoDisponible,
      motivo_no_evaluable:
        motivo,
      evaluabilidad
    },
    hallazgos: [
      {
        tipo:
          evaluabilidad === "SIN_CONFIGURAR"
            ? "CONFIGURACION_INCOMPLETA"
            : "DATOS_INSUFICIENTES",
        evidencia:
          motivo,
        impacto_financiero_estimado:
          0,
        confianza:
          100
      }
    ]
  };
}

test("SIN_CONFIGURAR no se interpreta como alerta operativa", () => {
  const r = reporte(
    "FINANZAS",
    "margen_bruto_confiable",
    "SIN_CONFIGURAR",
    {
      valorActual: 86.34,
      medicionDisponible: true,
      motivo:
        "Falta configurar margen objetivo."
    }
  );

  const e =
    evaluabilidadReporte(r);

  assert.equal(
    e.evaluable,
    false
  );

  assert.equal(
    e.estado,
    "SIN_CONFIGURAR"
  );

  const hechos =
    hechosReporte(r);

  assert.ok(
    hechos.some(
      (item) =>
        /todavía no evaluable/i
          .test(item)
    )
  );

  assert.equal(
    hechos.some(
      (item) =>
        /estado ALERTA/i
          .test(item)
    ),
    false
  );
});

test("Junta agrupa configuración pendiente como una sola brecha", async () => {
  const reportes = [
    reporte(
      "FINANZAS",
      "margen_bruto_confiable",
      "SIN_CONFIGURAR",
      {
        valorActual: 86.34,
        medicionDisponible: true,
        motivo:
          "Falta configurar margen objetivo."
      }
    ),
    reporte(
      "VENTAS",
      "ticket_promedio",
      "SIN_CONFIGURAR",
      {
        valorActual: 23746.88,
        medicionDisponible: true,
        motivo:
          "Falta configurar ticket objetivo."
      }
    ),
    reporte(
      "MARKETING",
      "cac",
      "SIN_CONFIGURAR",
      {
        motivo:
          "Falta configurar CAC máximo."
      }
    ),
    reporte(
      "OPERACIONES",
      "porcentaje_items_agotados",
      "DATOS_INSUFICIENTES",
      {
        objetivoDisponible: true,
        valorObjetivo: 0,
        motivo:
          "No existen items activos de inventario para medir disponibilidad."
      }
    ),
    reporte(
      "GENTE",
      "empleados_actuales",
      "SIN_CONFIGURAR",
      {
        motivo:
          "Falta configurar empleados actuales."
      }
    )
  ];

  const resultado =
    await generarRespuestasExpertas({
      pregunta:
        "Analiza el estado general de la empresa.",
      decision:
        null,
      reportes,
      intervenciones:
        [],
      fuente:
        "GRUK"
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

  for (
    const respuesta of
    resultado.respuestas
  ) {
    assert.equal(
      /El KPI disponible está ALERTA/i
        .test(
          respuesta.respuesta
        ),
      false
    );
  }
});

test("diagnóstico antiguo de Junta se invalida", () => {
  assert.equal(
    diagnosticosExpertosObsoletos([
      {
        respuesta:
          "El KPI disponible está ALERTA.",
        evidencia:
          [
            "MARKETING: cac — estado ALERTA."
          ]
      }
    ]),
    true
  );

  assert.equal(
    diagnosticosExpertosObsoletos([
      {
        respuesta:
          "La configuración base necesaria todavía está pendiente. No la interpreto como una alerta del negocio.",
        evidencia:
          [
            "FINANZAS: margen — todavía no evaluable como señal operativa."
          ]
      }
    ]),
    false
  );
});
