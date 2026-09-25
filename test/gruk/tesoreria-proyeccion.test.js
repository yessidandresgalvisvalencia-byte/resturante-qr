"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Compra = require("../../models/Compra");
const Gasto = require("../../models/Gasto");
const Venta = require("../../models/Venta");
const CuentaTesoreria = require("../../core/finanzas/models/CuentaTesoreria");
const MovimientoCaja = require("../../core/finanzas/models/MovimientoCaja");
const TransferenciaTesoreria = require("../../core/finanzas/models/TransferenciaTesoreria");
const {
  crearCuenta
} = require("../../core/finanzas/tesoreria.service");
const {
  construirProyeccionTesoreria
} = require("../../core/finanzas/tesoreriaProyeccion.service");

const EMPRESA_ID = "507f1f77bcf86cd799439201";
const SEDE_ID = "507f1f77bcf86cd799439202";
const USUARIO_ID = "507f1f77bcf86cd799439203";

function fechaMasDias(base, dias) {
  return new Date(
    base.getTime() +
    dias * 24 * 60 * 60 * 1000
  );
}

test.before(async () => {
  const uri = process.env.TEST_MONGO_URI;
  if (!uri) throw new Error("TEST_MONGO_URI requerido");

  await mongoose.connect(uri, {
    dbName: "gruk_test_tesoreria_proyeccion"
  });
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Promise.all([
    Compra.deleteMany({}),
    Gasto.deleteMany({}),
    Venta.deleteMany({}),
    CuentaTesoreria.deleteMany({}),
    MovimientoCaja.deleteMany({}),
    TransferenciaTesoreria.deleteMany({})
  ]);
});

test("proyeccion 7d distingue caja actual de cobros esperados", async () => {
  const ahora = new Date();
  const apertura = new Date(
    ahora.getTime() - 24 * 60 * 60 * 1000
  );

  await crearCuenta({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID,
    nombre: "Banco principal",
    tipo: "BANCO",
    saldoInicial: 100000,
    saldoInicialAt: apertura,
    metodosPagoAsociados: ["transferencia"],
    createdBy: USUARIO_ID
  });

  await Compra.create({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID,
    proveedor: "Proveedor",
    items: [],
    subtotal: 150000,
    impuestos: 0,
    total: 150000,
    metodoPago: "credito",
    estadoPago: "pendiente",
    fechaVencimientoPago: fechaMasDias(ahora, 3),
    estado: "registrada",
    fecha: ahora
  });

  await Venta.create({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID,
    concepto: "Venta a credito",
    cantidad: 1,
    precioUnitario: 100000,
    total: 100000,
    estado: "pendiente",
    fechaVencimientoCobro: fechaMasDias(ahora, 2),
    fecha: ahora
  });

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId: EMPRESA_ID,
      sedeId: SEDE_ID,
      ahora
    });

  assert.equal(proyeccion.confiabilidad, "COMPLETO");
  assert.equal(proyeccion.saldoActual, 100000);
  assert.equal(
    proyeccion.obligaciones.proximos7d.monto,
    150000
  );
  assert.equal(
    proyeccion.cobrosEsperados.proximos7d.monto,
    100000
  );
  assert.equal(
    proyeccion.escenario7d.estado,
    "DEPENDE_DE_COBROS"
  );
  assert.equal(
    proyeccion.escenario7d.saldoDespuesDeObligacionesConCajaActual,
    -50000
  );
  assert.equal(
    proyeccion.escenario7d.saldoSiSeCobraTodoLoEsperado,
    50000
  );
});

test("compra parcial sin monto acumulado vuelve la proyeccion PARCIAL", async () => {
  const ahora = new Date();

  await crearCuenta({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID,
    nombre: "Caja",
    tipo: "EFECTIVO",
    saldoInicial: 200000,
    saldoInicialAt: new Date(
      ahora.getTime() - 60 * 60 * 1000
    ),
    createdBy: USUARIO_ID
  });

  await Compra.create({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID,
    proveedor: "Proveedor parcial",
    items: [],
    subtotal: 300000,
    impuestos: 0,
    total: 300000,
    metodoPago: "credito",
    estadoPago: "parcial",
    fechaVencimientoPago: fechaMasDias(ahora, 4),
    estado: "registrada",
    fecha: ahora
  });

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId: EMPRESA_ID,
      sedeId: SEDE_ID,
      ahora
    });

  assert.equal(proyeccion.confiabilidad, "PARCIAL");
  assert.equal(
    proyeccion.comprasParcialesSinSaldoExacto.length,
    1
  );
  assert.equal(
    proyeccion.escenario7d.estado,
    "DATOS_INSUFICIENTES"
  );

  assert.ok(
    proyeccion.advertencias.some(
      (item) => /sin saldo pendiente exacto/i.test(item)
    )
  );
});


test("obligacion sin fecha vuelve la proyeccion PARCIAL y bloquea conclusion de cobertura", async () => {
  const ahora = new Date();

  await crearCuenta({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID,
    nombre: "Banco cobertura",
    tipo: "BANCO",
    saldoInicial: 500000,
    saldoInicialAt: new Date(
      ahora.getTime() -
      60 * 60 * 1000
    ),
    createdBy: USUARIO_ID
  });

  await Gasto.create({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID,
    concepto: "Imprevisto pendiente",
    categoria: "Otro",
    monto: 120000,
    estadoPago: "pendiente",
    fechaVencimientoPago: null,
    estado: "registrado",
    fecha: ahora
  });

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId: EMPRESA_ID,
      sedeId: SEDE_ID,
      ahora
    });

  assert.equal(
    proyeccion.confiabilidad,
    "PARCIAL"
  );

  assert.equal(
    proyeccion.escenario7d.estado,
    "DATOS_INSUFICIENTES"
  );

  assert.equal(
    proyeccion.obligaciones.sinFecha.cantidad,
    1
  );

  assert.equal(
    proyeccion.escenario7d.saldoDespuesDeObligacionesConCajaActual,
    null
  );
});

test("compra parcial con saldo exacto mantiene proyeccion cuantificada", async () => {
  const ahora = new Date();

  await crearCuenta({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID,
    nombre: "Banco parcial exacto",
    tipo: "BANCO",
    saldoInicial: 150000,
    saldoInicialAt: new Date(
      ahora.getTime() -
      60 * 60 * 1000
    ),
    createdBy: USUARIO_ID
  });

  await Compra.create({
    empresaId: EMPRESA_ID,
    sedeId: SEDE_ID,
    proveedor: "Proveedor exacto",
    items: [],
    subtotal: 300000,
    impuestos: 0,
    total: 300000,
    metodoPago: "credito",
    estadoPago: "parcial",
    saldoPendientePago: 80000,
    fechaVencimientoPago: fechaMasDias(ahora, 3),
    estado: "registrada",
    fecha: ahora
  });

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId: EMPRESA_ID,
      sedeId: SEDE_ID,
      ahora
    });

  assert.equal(
    proyeccion.confiabilidad,
    "COMPLETO"
  );

  assert.equal(
    proyeccion.obligaciones.proximos7d.monto,
    80000
  );

  assert.equal(
    proyeccion.escenario7d.estado,
    "CUBIERTO_CON_CAJA_ACTUAL"
  );

  assert.equal(
    proyeccion.escenario7d.saldoDespuesDeObligacionesConCajaActual,
    70000
  );
});
