"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const MovimientoCaja = require(
  "../../core/finanzas/models/MovimientoCaja"
);
const {
  construirCandidatoDesdeEvento,
  registrarMovimientoDesdeEvento,
  obtenerResumenCaja
} = require("../../core/finanzas/caja.service");

const EMPRESA_ID =
  "507f1f77bcf86cd799439001";
const SEDE_ID =
  "507f1f77bcf86cd799439002";

test.before(async () => {
  const uri =
    process.env.TEST_MONGO_URI;

  if (!uri) {
    throw new Error(
      "TEST_MONGO_URI requerido"
    );
  }

  await mongoose.connect(
    uri,
    {
      dbName:
        "gruk_test_caja"
    }
  );

  await MovimientoCaja.deleteMany({});
});

test.after(async () => {
  await MovimientoCaja.deleteMany({});
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await MovimientoCaja.deleteMany({});
});

test("venta pagada crea una entrada canonica", () => {
  const candidato =
    construirCandidatoDesdeEvento({
      eventName:
        "VENTA_COMPLETADA",
      occurredAt:
        new Date(
          "2026-09-25T14:00:00Z"
        ),
      payload: {
        ventaId:
          "507f1f77bcf86cd799439011",
        empresaId:
          EMPRESA_ID,
        sedeId:
          SEDE_ID,
        total: 120000,
        metodoPago:
          "efectivo",
        fecha:
          "2026-09-25T13:55:00Z",
        sourceUpdatedAt:
          "2026-09-25T14:00:00Z"
      }
    });

  assert.ok(candidato);
  assert.equal(
    candidato.accion,
    "CONFIRMAR"
  );
  assert.equal(
    candidato.direccion,
    "ENTRADA"
  );
  assert.equal(
    candidato.monto,
    120000
  );
});

test("gasto pendiente no crea movimiento de caja", () => {
  const candidato =
    construirCandidatoDesdeEvento({
      eventName:
        "GASTO_REGISTRADO",
      occurredAt:
        new Date(
          "2026-09-25T15:00:00Z"
        ),
      payload: {
        gastoId:
          "507f1f77bcf86cd799439012",
        empresaId:
          EMPRESA_ID,
        monto: 300000,
        estadoPago:
          "pendiente"
      }
    });

  assert.equal(
    candidato,
    null
  );
});

test("pago tardio se contabiliza en la fecha de confirmacion y no en la fecha original", () => {
  const candidato =
    construirCandidatoDesdeEvento({
      eventName:
        "COMPRA_PAGO_ACTUALIZADO",
      occurredAt:
        new Date(
          "2026-09-25T16:00:00Z"
        ),
      payload: {
        compraId:
          "507f1f77bcf86cd799439013",
        empresaId:
          EMPRESA_ID,
        total: 210000,
        estadoPagoAnterior:
          "pendiente",
        estadoPago:
          "pagado",
        fecha:
          "2026-08-10T12:00:00Z",
        sourceUpdatedAt:
          "2026-09-25T15:59:30Z"
      }
    });

  assert.equal(
    candidato
      .confirmadoAt
      .toISOString(),
    "2026-09-25T15:59:30.000Z"
  );
});

test("repetir el mismo evento no duplica caja", async () => {
  const event = {
    eventName:
      "VENTA_COMPLETADA",
    occurredAt:
      new Date(
        "2026-09-25T17:00:00Z"
      ),
    payload: {
      ventaId:
        "507f1f77bcf86cd799439014",
      empresaId:
        EMPRESA_ID,
      sedeId:
        SEDE_ID,
      total: 100000,
      metodoPago:
        "transferencia",
      fecha:
        "2026-09-25T17:00:00Z",
      sourceUpdatedAt:
        "2026-09-25T17:00:00Z"
    }
  };

  const primero =
    await registrarMovimientoDesdeEvento(
      event,
      { emitirEvento: false }
    );

  const segundo =
    await registrarMovimientoDesdeEvento(
      event,
      { emitirEvento: false }
    );

  assert.equal(
    primero.creado,
    true
  );

  assert.equal(
    segundo.creado,
    false
  );

  assert.equal(
    await MovimientoCaja.countDocuments({}),
    1
  );
});

test("pasar de pagado a pendiente crea reversion y elimina el efecto neto", async () => {
  const gastoId =
    "507f1f77bcf86cd799439015";

  await registrarMovimientoDesdeEvento(
    {
      eventName:
        "GASTO_REGISTRADO",
      occurredAt:
        new Date(
          "2026-09-25T18:00:00Z"
        ),
      payload: {
        gastoId,
        empresaId:
          EMPRESA_ID,
        sedeId:
          SEDE_ID,
        monto: 50000,
        estadoPago:
          "pagado",
        fecha:
          "2026-09-25T18:00:00Z",
        sourceUpdatedAt:
          "2026-09-25T18:00:00Z"
      }
    },
    { emitirEvento: false }
  );

  await registrarMovimientoDesdeEvento(
    {
      eventName:
        "GASTO_PAGO_ACTUALIZADO",
      occurredAt:
        new Date(
          "2026-09-25T19:00:00Z"
        ),
      payload: {
        gastoId,
        empresaId:
          EMPRESA_ID,
        sedeId:
          SEDE_ID,
        monto: 50000,
        estadoPagoAnterior:
          "pagado",
        estadoPago:
          "pendiente",
        fecha:
          "2026-09-25T18:00:00Z",
        sourceUpdatedAt:
          "2026-09-25T19:00:00Z"
      }
    },
    { emitirEvento: false }
  );

  const resumen =
    await obtenerResumenCaja({
      empresaId:
        EMPRESA_ID,
      sedeId:
        SEDE_ID,
      desde:
        new Date(
          "2026-09-25T00:00:00Z"
        ),
      hasta:
        new Date(
          "2026-09-26T00:00:00Z"
        )
    });

  assert.equal(
    await MovimientoCaja.countDocuments({}),
    2
  );

  assert.equal(
    resumen.gastosPagados.monto,
    0
  );

  assert.equal(
    resumen.flujoConfirmadoParcial,
    0
  );
});

test("referencia economica explicita evita doble conteo entre documentos distintos", async () => {
  const referencia =
    "PAGO-PROVEEDOR-ABC-001";

  const base = {
    empresaId:
      EMPRESA_ID,
    sedeId:
      SEDE_ID,
    monto: 70000,
    estadoPago:
      "pagado",
    cajaReferencia:
      referencia
  };

  await registrarMovimientoDesdeEvento(
    {
      eventName:
        "GASTO_REGISTRADO",
      occurredAt:
        new Date(
          "2026-09-25T20:00:00Z"
        ),
      payload: {
        ...base,
        gastoId:
          "507f1f77bcf86cd799439016",
        fecha:
          "2026-09-25T20:00:00Z",
        sourceUpdatedAt:
          "2026-09-25T20:00:00Z"
      }
    },
    { emitirEvento: false }
  );

  const segundo =
    await registrarMovimientoDesdeEvento(
      {
        eventName:
          "COMPRA_REGISTRADA",
        occurredAt:
          new Date(
            "2026-09-25T20:01:00Z"
          ),
        payload: {
          empresaId:
            EMPRESA_ID,
          sedeId:
            SEDE_ID,
          compraId:
            "507f1f77bcf86cd799439017",
          total: 70000,
          estadoPago:
            "pagado",
          cajaReferencia:
            referencia,
          fecha:
            "2026-09-25T20:01:00Z",
          sourceUpdatedAt:
            "2026-09-25T20:01:00Z"
        }
      },
      { emitirEvento: false }
    );

  assert.equal(
    segundo.creado,
    false
  );

  assert.equal(
    segundo.deduplicado,
    true
  );

  assert.equal(
    await MovimientoCaja.countDocuments({}),
    1
  );
});


test("reversion posterior elimina el efecto del periodo original sin simular reembolso", async () => {
  const gastoId =
    "507f1f77bcf86cd799439018";

  await registrarMovimientoDesdeEvento(
    {
      eventName:
        "GASTO_REGISTRADO",
      occurredAt:
        new Date(
          "2026-08-10T12:00:00Z"
        ),
      payload: {
        gastoId,
        empresaId:
          EMPRESA_ID,
        sedeId:
          SEDE_ID,
        monto: 90000,
        estadoPago:
          "pagado",
        fecha:
          "2026-08-10T12:00:00Z",
        sourceUpdatedAt:
          "2026-08-10T12:00:00Z"
      }
    },
    { emitirEvento: false }
  );

  await registrarMovimientoDesdeEvento(
    {
      eventName:
        "GASTO_PAGO_ACTUALIZADO",
      occurredAt:
        new Date(
          "2026-09-25T12:00:00Z"
        ),
      payload: {
        gastoId,
        empresaId:
          EMPRESA_ID,
        sedeId:
          SEDE_ID,
        monto: 90000,
        estadoPagoAnterior:
          "pagado",
        estadoPago:
          "pendiente",
        fecha:
          "2026-08-10T12:00:00Z",
        sourceUpdatedAt:
          "2026-09-25T12:00:00Z"
      }
    },
    { emitirEvento: false }
  );

  const agosto =
    await obtenerResumenCaja({
      empresaId:
        EMPRESA_ID,
      sedeId:
        SEDE_ID,
      desde:
        new Date(
          "2026-08-01T00:00:00Z"
        ),
      hasta:
        new Date(
          "2026-09-01T00:00:00Z"
        )
    });

  const septiembre =
    await obtenerResumenCaja({
      empresaId:
        EMPRESA_ID,
      sedeId:
        SEDE_ID,
      desde:
        new Date(
          "2026-09-01T00:00:00Z"
        ),
      hasta:
        new Date(
          "2026-10-01T00:00:00Z"
        )
    });

  assert.equal(
    agosto.gastosPagados.monto,
    0
  );

  assert.equal(
    septiembre.entradasConfirmadas,
    0
  );

  assert.equal(
    septiembre.flujoConfirmadoParcial,
    0
  );
});
