"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Compra = require("../../models/Compra");
const Gasto = require("../../models/Gasto");
const CuentaTesoreria = require(
  "../../core/finanzas/models/CuentaTesoreria"
);
const MovimientoCaja = require(
  "../../core/finanzas/models/MovimientoCaja"
);
const {
  crearCuenta
} = require("../../core/finanzas/tesoreria.service");
const {
  obtenerObligacionesRegistradas
} = require("../../core/finanzas/obligaciones.service");

const EMPRESA_ID =
  "507f1f77bcf86cd799439301";
const SEDE_ID =
  "507f1f77bcf86cd799439302";
const USUARIO_ID =
  "507f1f77bcf86cd799439303";

function masDias(fecha, dias) {
  return new Date(
    fecha.getTime() +
    dias * 24 * 60 * 60 * 1000
  );
}

async function cuentaConSaldo(
  saldo,
  ahora
) {
  return crearCuenta({
    empresaId:
      EMPRESA_ID,
    sedeId:
      SEDE_ID,
    nombre:
      "Banco prueba",
    tipo:
      "BANCO",
    saldoInicial:
      saldo,
    saldoInicialAt:
      new Date(
        ahora.getTime() -
        60 * 60 * 1000
      ),
    createdBy:
      USUARIO_ID
  });
}

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
        "gruk_test_obligaciones"
    }
  );
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Promise.all([
    Compra.deleteMany({}),
    Gasto.deleteMany({}),
    CuentaTesoreria.deleteMany({}),
    MovimientoCaja.deleteMany({})
  ]);
});

test("cobertura 7d usa saldo disponible contra obligaciones pendientes cuantificadas", async () => {
  const ahora = new Date();

  await cuentaConSaldo(
    200000,
    ahora
  );

  await Compra.create({
    empresaId:
      EMPRESA_ID,
    sedeId:
      SEDE_ID,
    proveedor:
      "Proveedor A",
    items: [],
    subtotal:
      150000,
    impuestos: 0,
    total:
      150000,
    metodoPago:
      "credito",
    estadoPago:
      "pendiente",
    saldoPendientePago:
      150000,
    fechaVencimientoPago:
      masDias(ahora, 3),
    estado:
      "registrada",
    fecha:
      ahora
  });

  const resultado =
    await obtenerObligacionesRegistradas({
      empresaId:
        EMPRESA_ID,
      sedeId:
        SEDE_ID,
      ahora
    });

  assert.equal(
    resultado.montoExigible7Dias,
    150000
  );

  assert.equal(
    resultado.cobertura7Dias,
    "SUFICIENTE"
  );

  assert.equal(
    resultado.saldoDespues7Dias,
    50000
  );
});

test("compra parcial usa saldo pendiente exacto y no el total original", async () => {
  const ahora = new Date();

  await cuentaConSaldo(
    100000,
    ahora
  );

  await Compra.create({
    empresaId:
      EMPRESA_ID,
    sedeId:
      SEDE_ID,
    proveedor:
      "Proveedor parcial",
    items: [],
    subtotal:
      300000,
    impuestos: 0,
    total:
      300000,
    metodoPago:
      "credito",
    estadoPago:
      "parcial",
    saldoPendientePago:
      80000,
    fechaVencimientoPago:
      masDias(ahora, 2),
    estado:
      "registrada",
    fecha:
      ahora
  });

  const resultado =
    await obtenerObligacionesRegistradas({
      empresaId:
        EMPRESA_ID,
      sedeId:
        SEDE_ID,
      ahora
    });

  assert.equal(
    resultado.montoExigible7Dias,
    80000
  );

  assert.equal(
    resultado.saldoDespues7Dias,
    20000
  );
});

test("obligacion sin fecha impide declarar cobertura confiable", async () => {
  const ahora = new Date();

  await cuentaConSaldo(
    500000,
    ahora
  );

  await Gasto.create({
    empresaId:
      EMPRESA_ID,
    sedeId:
      SEDE_ID,
    concepto:
      "Arriendo",
    categoria:
      "Administracion",
    monto:
      120000,
    estadoPago:
      "pendiente",
    fechaVencimientoPago:
      null,
    estado:
      "registrado",
    fecha:
      ahora
  });

  const resultado =
    await obtenerObligacionesRegistradas({
      empresaId:
        EMPRESA_ID,
      sedeId:
        SEDE_ID,
      ahora
    });

  assert.equal(
    resultado.obligacionesSinFecha,
    1
  );

  assert.equal(
    resultado.cobertura7Dias,
    "NO_CONFIABLE_DATOS_FALTANTES"
  );

  assert.equal(
    resultado.saldoDespues7Dias,
    null
  );
});

test("gasto con pago desconocido no se convierte en deuda cuantificada", async () => {
  const ahora = new Date();

  await cuentaConSaldo(
    500000,
    ahora
  );

  await Gasto.create({
    empresaId:
      EMPRESA_ID,
    sedeId:
      SEDE_ID,
    concepto:
      "Gasto historico",
    categoria:
      "Otro",
    monto:
      90000,
    estadoPago:
      "desconocido",
    fechaVencimientoPago:
      masDias(ahora, 2),
    estado:
      "registrado",
    fecha:
      ahora
  });

  const resultado =
    await obtenerObligacionesRegistradas({
      empresaId:
        EMPRESA_ID,
      sedeId:
        SEDE_ID,
      ahora
    });

  assert.equal(
    resultado.montoExigible7Dias,
    0
  );

  assert.equal(
    resultado.noCuantificadasExigibles,
    1
  );

  assert.equal(
    resultado.cobertura7Dias,
    "NO_CONFIABLE_DATOS_FALTANTES"
  );
});
