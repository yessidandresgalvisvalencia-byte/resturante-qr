"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  construirAgendaFinanciera,
  resolverDeadline,
  seleccionarCobrosParaBrecha,
  construirPlanPagos
} = require(
  "../../intelligence/brain/agendaFinanciera.service"
);

const {
  convertirAgendaEnOrdenes,
  construirDecisionFingerprint
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


test("fingerprint ignora deadline movil y conserva misma situacion", () => {
  const base = {
    estado7d: "DEPENDE_DE_COBROS",
    confiabilidad: "COMPLETO",
    saldoActual: 100000,
    obligaciones7d: 250000,
    cobros7d: 200000,
    faltanteConCajaActual: 150000,
    faltanteAunCobrandoTodo: 0,
    accionesSugeridas: [
      {
        departamento: "FINANZAS",
        codigo: "CONTROLAR_BRECHA_CAJA_7D",
        prioridad: "ALTA",
        deadline: new Date("2026-09-27T00:00:00Z"),
        kpi_a_medir: "brecha_caja_7d",
        montoReferencia: 150000
      }
    ]
  };

  const a = construirDecisionFingerprint({
    agenda: base,
    candidatos: []
  });

  const b = construirDecisionFingerprint({
    agenda: {
      ...base,
      fechaCritica: new Date("2026-09-28T00:00:00Z"),
      accionesSugeridas: [
        {
          ...base.accionesSugeridas[0],
          deadline: new Date("2026-09-29T00:00:00Z")
        }
      ]
    },
    candidatos: []
  });

  assert.equal(a, b);
});

test("fingerprint cambia cuando cambia materialmente la brecha", () => {
  const agenda = {
    estado7d: "DEPENDE_DE_COBROS",
    confiabilidad: "COMPLETO",
    saldoActual: 100000,
    obligaciones7d: 250000,
    cobros7d: 200000,
    faltanteConCajaActual: 150000,
    faltanteAunCobrandoTodo: 0,
    accionesSugeridas: [
      {
        departamento: "FINANZAS",
        codigo: "CONTROLAR_BRECHA_CAJA_7D",
        prioridad: "ALTA",
        kpi_a_medir: "brecha_caja_7d",
        montoReferencia: 150000
      }
    ]
  };

  const a = construirDecisionFingerprint({
    agenda,
    candidatos: []
  });

  const b = construirDecisionFingerprint({
    agenda: {
      ...agenda,
      saldoActual: 130000,
      faltanteConCajaActual: 120000,
      accionesSugeridas: [
        {
          ...agenda.accionesSugeridas[0],
          montoReferencia: 120000
        }
      ]
    },
    candidatos: []
  });

  assert.notEqual(a, b);
});


test("prioriza vencidos, luego proximos 7 dias y excluye cobros de 20 dias", () => {
  const seleccion =
    seleccionarCobrosParaBrecha(
      [
        {
          id: "v3",
          descripcion: "Factura 20 dias",
          monto: 500000,
          fechaVencimiento: "2026-10-15T00:00:00Z",
          clasificacion: "PROXIMOS_30_DIAS"
        },
        {
          id: "v2",
          descripcion: "Factura manana",
          monto: 90000,
          fechaVencimiento: "2026-09-26T00:00:00Z",
          clasificacion: "PROXIMOS_7_DIAS"
        },
        {
          id: "v1",
          descripcion: "Factura vencida",
          monto: 100000,
          fechaVencimiento: "2026-09-20T00:00:00Z",
          clasificacion: "VENCIDA"
        }
      ],
      150000
    );

  assert.deepEqual(
    seleccion.map(
      (item) => item.id
    ),
    ["v2", "v1"]
  );

  assert.equal(
    seleccion.some(
      (item) => item.id === "v3"
    ),
    false
  );
});

test("agenda calcula remanente despues de los cobros priorizados", () => {
  const agenda =
    construirAgendaFinanciera({
      confiabilidad: "COMPLETO",
      saldoActual: 100000,
      obligaciones: {
        proximos7d: {
          monto: 400000
        }
      },
      cobrosEsperados: {
        proximos7d: {
          monto: 200000
        },
        prioridadCobro: [
          {
            id: "v1",
            descripcion: "Cobro vencido",
            monto: 120000,
            fechaVencimiento: "2026-09-20T00:00:00Z",
            clasificacion: "VENCIDA"
          },
          {
            id: "v2",
            descripcion: "Cobro 3 dias",
            monto: 80000,
            fechaVencimiento: "2026-09-28T00:00:00Z",
            clasificacion: "PROXIMOS_7_DIAS"
          }
        ]
      },
      escenario7d: {
        estado: "DEFICIT_AUN_COBRANDO_TODO",
        faltanteConCajaActual: 300000,
        faltanteAunCobrandoTodo: 100000
      }
    });

  assert.equal(
    agenda.montoCobrosPriorizados,
    200000
  );

  assert.equal(
    agenda.faltanteDespuesCobrosPriorizados,
    100000
  );

  const ventas =
    agenda.accionesSugeridas.find(
      (item) =>
        item.departamento === "VENTAS"
    );

  assert.equal(
    ventas.cobrosPriorizados.length,
    2
  );
});


test("plan de pagos conserva prioridad y marca cobertura completa por obligacion", () => {
  const prioridad = [
    {
      id: "o1",
      tipo: "GASTO",
      descripcion: "Nomina vencida",
      categoria: "NOMINA",
      monto: 120000,
      fechaVencimiento: "2026-09-24T00:00:00Z"
    },
    {
      id: "o2",
      tipo: "COMPRA",
      descripcion: "Proveedor",
      monto: 90000,
      fechaVencimiento: "2026-09-26T00:00:00Z"
    },
    {
      id: "o3",
      tipo: "GASTO",
      descripcion: "Servicio",
      categoria: "SERVICIOS",
      monto: 50000,
      fechaVencimiento: "2026-09-27T00:00:00Z"
    }
  ];

  const plan =
    construirPlanPagos(
      prioridad,
      180000
    );

  assert.deepEqual(
    plan.map(
      (item) =>
        item.estadoCobertura
    ),
    [
      "CUBIERTA",
      "NO_CUBIERTA",
      "CUBIERTA"
    ]
  );

  assert.deepEqual(
    plan.map(
      (item) =>
        item.descripcion
    ),
    [
      "Nomina vencida",
      "Proveedor",
      "Servicio"
    ]
  );
});

test("cobros priorizados amplian cobertura sin cambiar orden de pagos", () => {
  const agenda =
    construirAgendaFinanciera({
      confiabilidad: "COMPLETO",
      saldoActual: 100000,
      obligaciones: {
        proximos7d: {
          monto: 250000
        },
        prioridadPago: [
          {
            id: "o1",
            tipo: "GASTO",
            descripcion: "Obligacion uno",
            monto: 100000,
            fechaVencimiento: "2026-09-24T00:00:00Z"
          },
          {
            id: "o2",
            tipo: "COMPRA",
            descripcion: "Obligacion dos",
            monto: 150000,
            fechaVencimiento: "2026-09-27T00:00:00Z"
          }
        ]
      },
      cobrosEsperados: {
        proximos7d: {
          monto: 150000
        },
        prioridadCobro: [
          {
            id: "v1",
            descripcion: "Cobro vencido",
            monto: 150000,
            fechaVencimiento: "2026-09-24T00:00:00Z",
            clasificacion: "VENCIDA"
          }
        ]
      },
      escenario7d: {
        estado: "DEPENDE_DE_COBROS",
        faltanteConCajaActual: 150000,
        faltanteAunCobrandoTodo: 0
      }
    });

  assert.deepEqual(
    agenda.planPagosCajaActual.map(
      (item) =>
        item.estadoCobertura
    ),
    [
      "CUBIERTA",
      "NO_CUBIERTA"
    ]
  );

  assert.deepEqual(
    agenda.planPagosConCobros.map(
      (item) =>
        item.estadoCobertura
    ),
    [
      "CUBIERTA",
      "CUBIERTA"
    ]
  );

  assert.deepEqual(
    agenda.planPagosConCobros.map(
      (item) => item.id
    ),
    ["o1", "o2"]
  );
});
