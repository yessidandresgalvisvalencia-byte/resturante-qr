"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizarEvento,
  construirDiagnostico
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
