"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  construirAgendaFinanciera,
  resolverDeadline
} = require(
  "../../intelligence/brain/agendaFinanciera.service"
);

const {
  convertirAgendaEnOrdenes
} = require(
  "../../intelligence/brain/cerebro"
);

const {
  debeTomarDecision
} = require(
  "../../intelligence/orchestrator/cicloInteligencia"
);

test("agenda critica genera Finanzas Ventas y Direccion", () => {
  const ahora =
    new Date(
      "2026-09-25T12:00:00Z"
    );

  const agenda =
    construirAgendaFinanciera(
      {
        confiabilidad:
          "COMPLETO",
        saldoActual:
          100000,
        obligaciones: {
          proximos7d: {
            monto: 500000
          }
        },
        cobrosEsperados: {
          proximos7d: {
            monto: 200000
          }
        },
        escenario7d: {
          estado:
            "DEFICIT_AUN_COBRANDO_TODO",
          faltanteConCajaActual:
            400000,
          faltanteAunCobrandoTodo:
            200000
        },
        proximoVencimiento: {
          fechaVencimiento:
            "2026-09-27T00:00:00Z"
        }
      },
      ahora
    );

  assert.equal(
    agenda.requiereDecision,
    true
  );

  assert.equal(
    agenda.estado7d,
    "DEFICIT_AUN_COBRANDO_TODO"
  );

  assert.deepEqual(
    agenda.accionesSugeridas.map(
      (item) =>
        item.departamento
    ),
    [
      "FINANZAS",
      "VENTAS",
      "DIRECCION"
    ]
  );

  assert.ok(
    agenda.accionesSugeridas.every(
      (item) =>
        item.prioridad ===
        "CRITICA"
    )
  );

  const ordenes =
    convertirAgendaEnOrdenes(
      agenda
    );

  assert.equal(
    ordenes.length,
    3
  );

  assert.match(
    ordenes[0].tarea,
    /200000/
  );

  assert.equal(
    ordenes[0].kpi_a_medir,
    "brecha_caja_7d"
  );
});

test("agenda dependiente de cobros activa Finanzas y Ventas", () => {
  const agenda =
    construirAgendaFinanciera({
      confiabilidad:
        "COMPLETO",
      saldoActual:
        100000,
      obligaciones: {
        proximos7d: {
          monto: 250000
        }
      },
      cobrosEsperados: {
        proximos7d: {
          monto: 200000
        }
      },
      escenario7d: {
        estado:
          "DEPENDE_DE_COBROS",
        faltanteConCajaActual:
          150000,
        faltanteAunCobrandoTodo:
          0
      }
    });

  assert.deepEqual(
    agenda.accionesSugeridas.map(
      (item) =>
        item.departamento
    ),
    [
      "FINANZAS",
      "VENTAS"
    ]
  );

  assert.ok(
    agenda.accionesSugeridas.every(
      (item) =>
        item.prioridad ===
        "ALTA"
    )
  );
});

test("cobertura demostrada no genera orden financiera", () => {
  const agenda =
    construirAgendaFinanciera({
      confiabilidad:
        "COMPLETO",
      saldoActual:
        500000,
      obligaciones: {
        proximos7d: {
          monto: 200000
        }
      },
      cobrosEsperados: {
        proximos7d: {
          monto: 0
        }
      },
      escenario7d: {
        estado:
          "CUBIERTO_CON_CAJA_ACTUAL",
        faltanteConCajaActual:
          0,
        faltanteAunCobrandoTodo:
          0
      }
    });

  assert.equal(
    agenda.requiereDecision,
    false
  );

  assert.equal(
    agenda.accionesSugeridas.length,
    0
  );
});

test("agenda puede disparar Cerebro sin KPI CRITICO", () => {
  const reportes = [
    {
      kpi_principal: {
        estado: "OK"
      }
    },
    {
      kpi_principal: {
        estado: "ALERTA"
      }
    }
  ];

  assert.equal(
    debeTomarDecision(
      reportes,
      false,
      {
        requiereDecision: true
      }
    ),
    true
  );

  assert.equal(
    debeTomarDecision(
      reportes,
      false,
      {
        requiereDecision: false
      }
    ),
    false
  );
});

test("vencimiento ya vencido da 24 horas para reaccion operativa", () => {
  const ahora =
    new Date(
      "2026-09-25T12:00:00Z"
    );

  const deadline =
    resolverDeadline(
      {
        proximoVencimiento: {
          fechaVencimiento:
            "2026-09-24T12:00:00Z"
        }
      },
      ahora
    );

  assert.equal(
    deadline.toISOString(),
    "2026-09-26T12:00:00.000Z"
  );
});
