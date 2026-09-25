"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const CuentaTesoreria = require("../../core/finanzas/models/CuentaTesoreria");
const TransferenciaTesoreria = require("../../core/finanzas/models/TransferenciaTesoreria");
const MovimientoCaja = require("../../core/finanzas/models/MovimientoCaja");
const {
  crearCuenta,
  obtenerResumenTesoreria,
  normalizarMetodoPago
} = require("../../core/finanzas/tesoreria.service");
const {
  registrarMovimientoDesdeEvento
} = require("../../core/finanzas/caja.service");

const EMPRESA_ID = "507f1f77bcf86cd799439101";
const SEDE_ID = "507f1f77bcf86cd799439102";
const USUARIO_ID = "507f1f77bcf86cd799439103";

test.before(async () => {
  const uri = process.env.TEST_MONGO_URI;
  if (!uri) throw new Error("TEST_MONGO_URI requerido");

  await mongoose.connect(uri, {
    dbName: "gruk_test_tesoreria"
  });
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Promise.all([
    CuentaTesoreria.deleteMany({}),
    TransferenciaTesoreria.deleteMany({}),
    MovimientoCaja.deleteMany({})
  ]);
});

test("normaliza metodos de pago comunes", () => {
  assert.equal(normalizarMetodoPago("Efectivo"), "efectivo");
  assert.equal(normalizarMetodoPago("Datáfono"), "tarjeta");
  assert.equal(
    normalizarMetodoPago("Transferencia bancaria"),
    "transferencia"
  );
  assert.equal(normalizarMetodoPago("Nequi"), "nequi");
});

test("venta se asigna a la unica cuenta compatible y actualiza saldo", async () => {
  const cuenta = await crearCuenta({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID,
    nombre: "Caja principal",
    tipo: "EFECTIVO",
    saldoInicial: 500000,
    saldoInicialAt: "2026-09-25T12:00:00.000Z",
    metodosPagoAsociados: ["efectivo"],
    createdBy: USUARIO_ID
  });

  await registrarMovimientoDesdeEvento(
    {
      eventName: "VENTA_COMPLETADA",
      occurredAt: new Date("2026-09-25T13:00:00.000Z"),
      payload: {
        ventaId: "507f1f77bcf86cd799439111",
        empresaId: EMPRESA_ID,
        sedeId: SEDE_ID,
        total: 100000,
        metodoPago: "efectivo",
        fecha: "2026-09-25T13:00:00.000Z",
        sourceUpdatedAt: "2026-09-25T13:00:00.000Z"
      }
    },
    { emitirEvento: false }
  );

  const movimiento = await MovimientoCaja.findOne({
    origenTipo: "VENTA"
  }).lean();

  assert.equal(
    String(movimiento.cuentaTesoreriaId),
    String(cuenta._id)
  );
  assert.equal(movimiento.estadoAsignacionCuenta, "ASIGNADA");

  const resumen = await obtenerResumenTesoreria({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID
  });

  assert.equal(resumen.estadoConfiabilidad, "COMPLETO");
  assert.equal(resumen.saldoDisponible, 600000);
});

test("metodo ambiguo deja movimiento sin asignar y tesoreria PARCIAL", async () => {
  for (const nombre of ["Caja uno", "Caja dos"]) {
    await crearCuenta({
      empresaId: EMPRESA_ID,
      sedeId: SEDE_ID,
      nombre,
      tipo: "EFECTIVO",
      saldoInicial: 0,
      saldoInicialAt: "2026-09-25T12:00:00.000Z",
      metodosPagoAsociados: ["efectivo"],
      createdBy: USUARIO_ID
    });
  }

  await registrarMovimientoDesdeEvento(
    {
      eventName: "VENTA_COMPLETADA",
      occurredAt: new Date("2026-09-25T13:30:00.000Z"),
      payload: {
        ventaId: "507f1f77bcf86cd799439112",
        empresaId: EMPRESA_ID,
        sedeId: SEDE_ID,
        total: 80000,
        metodoPago: "efectivo",
        fecha: "2026-09-25T13:30:00.000Z",
        sourceUpdatedAt: "2026-09-25T13:30:00.000Z"
      }
    },
    { emitirEvento: false }
  );

  const movimiento = await MovimientoCaja.findOne({
    origenTipo: "VENTA"
  }).lean();

  assert.equal(movimiento.cuentaTesoreriaId, null);
  assert.equal(
    movimiento.estadoAsignacionCuenta,
    "SIN_ASIGNAR"
  );

  const resumen = await obtenerResumenTesoreria({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID
  });

  assert.equal(resumen.estadoConfiabilidad, "PARCIAL");
  assert.equal(
    resumen.movimientosSinAsignar.entradas.monto,
    80000
  );
});
