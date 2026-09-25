"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizarEvento,
  construirDiagnostico,
  construirPreguntaAutomatica,
  enriquecerReportesConCaja,
  generarDiagnosticosAutomaticos
} = require("../../intelligence/board/juntaViva.service");

test("Junta viva trata venta pagada como entrada confirmada", () => {
  const evento = normalizarEvento({
    eventName: "VENTA_COMPLETADA",
    occurredAt: new Date("2026-09-25T15:00:00Z"),
    payload: {
      ventaId: "507f1f77bcf86cd799439011",
      total: 120000
    }
  });

  assert.equal(
    evento.direccion,
    "ENTRADA_CONFIRMADA"
  );
  assert.equal(evento.monto, 120000);
});

test("Junta viva distingue gasto pagado de gasto sin pago confirmado", () => {
  const desconocido = normalizarEvento({
    eventName: "GASTO_REGISTRADO",
    payload: {
      gastoId: "507f1f77bcf86cd799439012",
      monto: 300000,
      estadoPago: "desconocido"
    }
  });

  const pagado = normalizarEvento({
    eventName: "GASTO_REGISTRADO",
    payload: {
      gastoId: "507f1f77bcf86cd799439015",
      monto: 80000,
      estadoPago: "pagado"
    }
  });

  assert.equal(
    desconocido.direccion,
    "SALIDA_REGISTRADA_NO_CONFIRMADA"
  );
  assert.equal(
    pagado.direccion,
    "SALIDA_CONFIRMADA"
  );
});

test("Junta viva diferencia compra pagada de compra pendiente", () => {
  const pagada = normalizarEvento({
    eventName: "COMPRA_REGISTRADA",
    payload: {
      compraId: "507f1f77bcf86cd799439013",
      total: 250000,
      estadoPago: "pagado"
    }
  });

  const pendiente = normalizarEvento({
    eventName: "COMPRA_REGISTRADA",
    payload: {
      compraId: "507f1f77bcf86cd799439014",
      total: 250000,
      estadoPago: "pendiente"
    }
  });

  assert.equal(
    pagada.direccion,
    "SALIDA_CONFIRMADA"
  );
  assert.equal(
    pendiente.direccion,
    "SALIDA_REGISTRADA_NO_CONFIRMADA"
  );
});

test("diagnostico vivo eleva CRITICO al Cerebro pero no emite orden", () => {
  const diagnostico = construirDiagnostico({
    ultimoEvento: {
      tipo: "VENTA_COMPLETADA",
      direccion: "ENTRADA_CONFIRMADA",
      monto: 100000
    },
    ventana24h: {
      ventasPagadas: {
        cantidad: 4,
        monto: 200000
      },
      comprasPagadas: {
        cantidad: 1,
        monto: 50000
      },
      gastosRegistrados: {
        cantidad: 2,
        monto: 40000
      },
      gastosPagados: {
        cantidad: 1,
        monto: 10000
      },
      gastosNoConfirmados: {
        cantidad: 1,
        monto: 30000
      },
      flujoConfirmadoParcial: 140000
    },
    reportes: [
      {
        neurona: "FINANZAS",
        kpi_principal: {
          nombre: "margen_bruto_confiable",
          estado: "CRITICO"
        }
      },
      {
        neurona: "VENTAS",
        kpi_principal: {
          nombre: "ticket_promedio",
          estado: "OK"
        }
      }
    ]
  });

  assert.equal(
    diagnostico.estado,
    "CRITICO"
  );
  assert.equal(
    diagnostico.requiereDecisionCerebro,
    true
  );
  assert.match(
    diagnostico.lectura,
    /requieren decision del Cerebro/i
  );
  assert.equal(
    Object.hasOwn(
      diagnostico,
      "ordenes"
    ),
    false
  );
});


test("Junta viva explica cuanto cambio el flujo desde la lectura anterior", () => {
  const diagnostico = construirDiagnostico({
    ultimoEvento: {
      tipo: "VENTA_COMPLETADA",
      direccion: "ENTRADA_CONFIRMADA",
      monto: 100000
    },
    ventana24h: {
      ventasPagadas: {
        cantidad: 3,
        monto: 180000
      },
      comprasPagadas: {
        cantidad: 0,
        monto: 0
      },
      gastosRegistrados: {
        cantidad: 0,
        monto: 0
      },
      gastosPagados: {
        cantidad: 0,
        monto: 0
      },
      gastosNoConfirmados: {
        cantidad: 0,
        monto: 0
      },
      flujoConfirmadoParcial: 180000
    },
    reportes: [],
    estadoAnterior: {
      ventana24h: {
        flujoConfirmadoParcial: 80000
      }
    }
  });

  assert.equal(
    diagnostico
      .cambioDesdeAnterior
      .direccion,
    "AUMENTA_FLUJO_PARCIAL"
  );

  assert.equal(
    diagnostico
      .cambioDesdeAnterior
      .valor,
    100000
  );

  assert.match(
    diagnostico
      .cambioDesdeAnterior
      .explicacion,
    /100000/
  );
});

test("actualizar un gasto a pagado se vuelve salida confirmada", () => {
  const evento = normalizarEvento({
    eventName:
      "GASTO_PAGO_ACTUALIZADO",
    payload: {
      gastoId:
        "507f1f77bcf86cd799439016",
      monto: 45000,
      estadoPagoAnterior:
        "pendiente",
      estadoPago:
        "pagado"
    }
  });

  assert.equal(
    evento.direccion,
    "SALIDA_CONFIRMADA"
  );
  assert.equal(
    evento.monto,
    45000
  );
});


test("actualizar una compra a pagada se vuelve salida confirmada", () => {
  const evento = normalizarEvento({
    eventName:
      "COMPRA_PAGO_ACTUALIZADO",
    payload: {
      compraId:
        "507f1f77bcf86cd799439017",
      total: 210000,
      estadoPagoAnterior:
        "pendiente",
      estadoPago:
        "pagado"
    }
  });

  assert.equal(
    evento.tipo,
    "COMPRA_PAGO_ACTUALIZADO"
  );
  assert.equal(
    evento.direccion,
    "SALIDA_CONFIRMADA"
  );
  assert.equal(
    evento.monto,
    210000
  );
});

test("flujo confirmado parcial negativo genera ATENCION sin afirmar caja negativa", () => {
  const diagnostico = construirDiagnostico({
    ultimoEvento: {
      tipo: "COMPRA_REGISTRADA",
      direccion: "SALIDA_CONFIRMADA",
      monto: 180000
    },
    ventana24h: {
      ventasPagadas: {
        cantidad: 2,
        monto: 100000
      },
      comprasPagadas: {
        cantidad: 1,
        monto: 180000
      },
      gastosRegistrados: {
        cantidad: 0,
        monto: 0
      },
      gastosPagados: {
        cantidad: 0,
        monto: 0
      },
      gastosNoConfirmados: {
        cantidad: 0,
        monto: 0
      },
      flujoConfirmadoParcial: -80000
    },
    reportes: []
  });

  assert.equal(
    diagnostico.estado,
    "ATENCION"
  );

  assert.ok(
    diagnostico.razones.some(
      (item) =>
        /no equivale a saldo de caja negativo/i.test(item)
    )
  );

  assert.match(
    diagnostico.lectura,
    /no es el saldo bancario ni la caja total/i
  );

  assert.equal(
    diagnostico.requiereDecisionCerebro,
    false
  );
});


test("pregunta automatica de venta declara cobro confirmado", () => {
  const pregunta =
    construirPreguntaAutomatica({
      tipo: "VENTA_COMPLETADA",
      direccion: "ENTRADA_CONFIRMADA",
      monto: 120000
    });

  assert.match(
    pregunta,
    /ya la cobre/i
  );
});

test("evidencia automatica incorpora caja confirmada a Finanzas", () => {
  const reportes =
    enriquecerReportesConCaja(
      [
        {
          neurona: "FINANZAS",
          kpi_principal: {
            nombre:
              "margen_bruto_confiable",
            valor_actual: 35,
            valor_objetivo: 40,
            estado: "ALERTA"
          },
          hallazgos: []
        }
      ],
      {
        entradasConfirmadas:
          200000,
        salidasConfirmadas:
          50000,
        flujoConfirmadoParcial:
          150000
      }
    );

  assert.ok(
    reportes[0]
      .hallazgos
      .some(
        (item) =>
          item.tipo ===
            "CAJA_CONFIRMADA_24H" &&
          /150000/.test(
            item.evidencia
          )
      )
  );
});

test("venta viva genera diagnostico experto relevante sin volver a preguntar por el cobro", async () => {
  const diagnosticos =
    await generarDiagnosticosAutomaticos({
      ultimoEvento: {
        tipo:
          "VENTA_COMPLETADA",
        direccion:
          "ENTRADA_CONFIRMADA",
        monto: 120000
      },
      ventana24h: {
        entradasConfirmadas:
          220000,
        salidasConfirmadas:
          70000,
        flujoConfirmadoParcial:
          150000,
        ventasPagadas: {
          cantidad: 4,
          monto: 220000
        },
        comprasPagadas: {
          cantidad: 1,
          monto: 50000
        },
        gastosPagados: {
          cantidad: 1,
          monto: 20000
        }
      },
      reportes: [
        {
          neurona: "FINANZAS",
          kpi_principal: {
            nombre:
              "margen_bruto_confiable",
            valor_actual: 35,
            valor_objetivo: 40,
            estado: "ALERTA"
          },
          hallazgos: []
        },
        {
          neurona: "VENTAS",
          kpi_principal: {
            nombre:
              "ticket_promedio",
            valor_actual:
              17141.43,
            valor_objetivo:
              25000,
            estado: "ALERTA"
          },
          hallazgos: []
        }
      ],
      ahora:
        new Date(
          "2026-09-25T21:00:00Z"
        )
    });

  const finanzas =
    diagnosticos.find(
      (item) =>
        item.departamento ===
        "FINANZAS"
    );

  const ventas =
    diagnosticos.find(
      (item) =>
        item.departamento ===
        "VENTAS"
    );

  const direccion =
    diagnosticos.find(
      (item) =>
        item.departamento ===
        "DIRECCION"
    );

  assert.ok(finanzas);
  assert.ok(ventas);
  assert.ok(direccion);

  assert.ok(
    finanzas.evidencia.some(
      (item) =>
        /CAJA GRUK 24H/i.test(item)
    )
  );

  assert.ok(
    finanzas.evidencia.some(
      (item) =>
        /^DATO_GRUK:/i.test(item)
    )
  );

  assert.equal(
    finanzas.evidencia.some(
      (item) =>
        /^DATO_USUARIO:/i.test(item)
    ),
    false
  );

  assert.ok(
    !finanzas.datosFaltantes.some(
      (item) =>
        /ya fue cobrada/i.test(item)
    )
  );

  assert.equal(
    diagnosticos.some(
      (item) =>
        item.departamento ===
        "GENTE"
    ),
    false
  );
});


test("tesoreria COMPLETA permite citar saldo disponible sin confundirlo con flujo", () => {
  const diagnostico = construirDiagnostico({
    ultimoEvento: {
      tipo: "RECALCULO",
      direccion: "NEUTRO",
      monto: null
    },
    ventana24h: {
      ventasPagadas: { cantidad: 1, monto: 100000 },
      comprasPagadas: { cantidad: 0, monto: 0 },
      comprasNoConfirmadas: { cantidad: 0, monto: 0 },
      gastosRegistrados: { cantidad: 0, monto: 0 },
      gastosPagados: { cantidad: 0, monto: 0 },
      gastosNoConfirmados: { cantidad: 0, monto: 0 },
      flujoConfirmadoParcial: 100000
    },
    tesoreria: {
      estadoConfiabilidad: "COMPLETO",
      saldoDisponible: 250000
    },
    reportes: []
  });

  assert.equal(
    diagnostico.estado,
    "NORMAL"
  );

  assert.match(
    diagnostico.lectura,
    /saldo disponible configurado de 250000/i
  );

  assert.match(
    diagnostico.lectura,
    /flujo confirmado parcial es 100000/i
  );
});

test("tesoreria PARCIAL obliga ATENCION y no trata saldo como definitivo", () => {
  const diagnostico = construirDiagnostico({
    ultimoEvento: {
      tipo: "RECALCULO",
      direccion: "NEUTRO",
      monto: null
    },
    ventana24h: {
      ventasPagadas: { cantidad: 0, monto: 0 },
      comprasPagadas: { cantidad: 0, monto: 0 },
      comprasNoConfirmadas: { cantidad: 0, monto: 0 },
      gastosRegistrados: { cantidad: 0, monto: 0 },
      gastosPagados: { cantidad: 0, monto: 0 },
      gastosNoConfirmados: { cantidad: 0, monto: 0 },
      flujoConfirmadoParcial: 0
    },
    tesoreria: {
      estadoConfiabilidad: "PARCIAL",
      saldoDisponible: 300000
    },
    reportes: []
  });

  assert.equal(
    diagnostico.estado,
    "ATENCION"
  );

  assert.ok(
    diagnostico.razones.some(
      (item) =>
        /no debe tratarse como disponibilidad definitiva/i.test(item)
    )
  );

  assert.match(
    diagnostico.lectura,
    /no debe tratarse como saldo definitivo/i
  );
});

test("evidencia de Finanzas distingue tesoreria de flujo del periodo", () => {
  const reportes = enriquecerReportesConCaja(
    [
      {
        neurona: "FINANZAS",
        kpi_principal: {
          nombre: "margen_bruto_confiable",
          estado: "OK"
        },
        hallazgos: []
      }
    ],
    {
      entradasConfirmadas: 180000,
      salidasConfirmadas: 50000,
      flujoConfirmadoParcial: 130000
    },
    {
      estadoConfiabilidad: "COMPLETO",
      saldoDisponible: 420000
    }
  );

  const tesoreria = reportes[0].hallazgos.find(
    (item) =>
      item.tipo === "TESORERIA_DISPONIBLE"
  );

  assert.ok(tesoreria);
  assert.equal(
    tesoreria.confianza,
    100
  );
  assert.match(
    tesoreria.evidencia,
    /420000/
  );
});


test("proyeccion que depende de cobros genera ATENCION pero no orden del Cerebro", () => {
  const diagnostico = construirDiagnostico({
    ultimoEvento: {
      tipo: "RECALCULO",
      direccion: "NEUTRO",
      monto: null
    },
    ventana24h: {
      ventasPagadas: { cantidad: 0, monto: 0 },
      comprasPagadas: { cantidad: 0, monto: 0 },
      comprasNoConfirmadas: { cantidad: 1, monto: 150000 },
      gastosRegistrados: { cantidad: 0, monto: 0 },
      gastosPagados: { cantidad: 0, monto: 0 },
      gastosNoConfirmados: { cantidad: 0, monto: 0 },
      flujoConfirmadoParcial: 0
    },
    tesoreria: {
      estadoConfiabilidad: "COMPLETO",
      saldoDisponible: 100000
    },
    proyeccionTesoreria: {
      confiabilidad: "COMPLETO",
      obligaciones: {
        proximos7d: { monto: 150000 }
      },
      cobrosEsperados: {
        proximos7d: { monto: 100000 }
      },
      escenario7d: {
        estado: "DEPENDE_DE_COBROS",
        faltanteAunCobrandoTodo: 0
      }
    },
    reportes: []
  });

  assert.equal(diagnostico.estado, "ATENCION");
  assert.equal(
    diagnostico.requiereDecisionCerebro,
    false
  );
  assert.ok(
    diagnostico.razones.some(
      (item) => /depende de cobrar/i.test(item)
    )
  );
});

test("deficit verificable aun cobrando todo genera CRITICO y requiere Cerebro", () => {
  const diagnostico = construirDiagnostico({
    ultimoEvento: {
      tipo: "RECALCULO",
      direccion: "NEUTRO",
      monto: null
    },
    ventana24h: {
      ventasPagadas: { cantidad: 0, monto: 0 },
      comprasPagadas: { cantidad: 0, monto: 0 },
      comprasNoConfirmadas: { cantidad: 1, monto: 250000 },
      gastosRegistrados: { cantidad: 0, monto: 0 },
      gastosPagados: { cantidad: 0, monto: 0 },
      gastosNoConfirmados: { cantidad: 0, monto: 0 },
      flujoConfirmadoParcial: 0
    },
    tesoreria: {
      estadoConfiabilidad: "COMPLETO",
      saldoDisponible: 50000
    },
    proyeccionTesoreria: {
      confiabilidad: "COMPLETO",
      obligaciones: {
        proximos7d: { monto: 250000 }
      },
      cobrosEsperados: {
        proximos7d: { monto: 50000 }
      },
      escenario7d: {
        estado: "DEFICIT_AUN_COBRANDO_TODO",
        faltanteAunCobrandoTodo: 150000
      }
    },
    reportes: []
  });

  assert.equal(diagnostico.estado, "CRITICO");
  assert.equal(
    diagnostico.requiereDecisionCerebro,
    true
  );
  assert.ok(
    diagnostico.razones.some(
      (item) => /faltante de 150000/i.test(item)
    )
  );
});
