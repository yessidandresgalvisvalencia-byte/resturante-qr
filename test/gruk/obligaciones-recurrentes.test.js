"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const ObligacionRecurrente = require(
  "../../core/finanzas/models/ObligacionRecurrente"
);
const CuentaTesoreria = require(
  "../../core/finanzas/models/CuentaTesoreria"
);
const MovimientoCaja = require(
  "../../core/finanzas/models/MovimientoCaja"
);
const Compra = require("../../models/Compra");
const Gasto = require("../../models/Gasto");

const {
  crearObligacionRecurrente,
  generarVencimientos
} = require(
  "../../core/finanzas/obligacionesRecurrentes.service"
);

const {
  crearCuenta
} = require(
  "../../core/finanzas/tesoreria.service"
);

const {
  obtenerObligacionesRegistradas
} = require(
  "../../core/finanzas/obligaciones.service"
);

const EMPRESA_ID =
  "507f1f77bcf86cd799439401";
const SEDE_ID =
  "507f1f77bcf86cd799439402";
const USUARIO_ID =
  "507f1f77bcf86cd799439403";

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
        "gruk_test_recurrentes"
    }
  );
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Promise.all([
    ObligacionRecurrente.deleteMany({}),
    CuentaTesoreria.deleteMany({}),
    MovimientoCaja.deleteMany({}),
    Compra.deleteMany({}),
    Gasto.deleteMany({})
  ]);
});

test("genera vencimientos mensuales respetando fecha fin", () => {
  const obligacion = {
    _id:
      new mongoose.Types.ObjectId(),
    sedeId:
      new mongoose.Types.ObjectId(
        SEDE_ID
      ),
    categoria:
      "ARRIENDO",
    nombre:
      "Arriendo local",
    monto:
      1000000,
    frecuencia:
      "MENSUAL",
    proximoVencimiento:
      new Date(
        "2026-09-25T00:00:00Z"
      ),
    fechaFin:
      new Date(
        "2026-11-25T00:00:00Z"
      ),
    fuenteMonto:
      "CONTRATO",
    tercero:
      "Arrendador"
  };

  const items =
    generarVencimientos({
      obligacion,
      desde:
        new Date(
          "2026-09-01T00:00:00Z"
        ),
      hasta:
        new Date(
          "2027-01-01T00:00:00Z"
        )
    });

  assert.equal(
    items.length,
    3
  );

  assert.deepEqual(
    items.map(
      (item) =>
        item.fechaVencimiento
          .toISOString()
          .slice(0, 10)
    ),
    [
      "2026-09-25",
      "2026-10-25",
      "2026-11-25"
    ]
  );
});

test("nomina recurrente dentro de 7 dias entra en cobertura", async () => {
  const ahora =
    new Date();

  await crearCuenta({
    empresaId:
      EMPRESA_ID,
    sedeId:
      SEDE_ID,
    nombre:
      "Banco nomina",
    tipo:
      "BANCO",
    saldoInicial:
      500000,
    saldoInicialAt:
      new Date(
        ahora.getTime() -
        60 * 60 * 1000
      ),
    createdBy:
      USUARIO_ID
  });

  await crearObligacionRecurrente({
    empresaId:
      EMPRESA_ID,
    sedeId:
      SEDE_ID,
    nombre:
      "Nomina",
    categoria:
      "NOMINA",
    monto:
      300000,
    frecuencia:
      "QUINCENAL",
    proximoVencimiento:
      new Date(
        ahora.getTime() +
        3 * 24 * 60 * 60 * 1000
      ),
    fuenteMonto:
      "HISTORICO",
    createdBy:
      USUARIO_ID
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
    300000
  );

  assert.equal(
    resultado.cobertura7Dias,
    "SUFICIENTE"
  );

  assert.equal(
    resultado.saldoDespues7Dias,
    200000
  );

  assert.equal(
    resultado.grupos
      .proximos7Dias
      .items
      .some(
        (item) =>
          item.origenTipo ===
          "RECURRENTE"
      ),
    true
  );
});

test("arriendo a 20 dias afecta 30d pero no cobertura 7d", async () => {
  const ahora =
    new Date();

  await crearCuenta({
    empresaId:
      EMPRESA_ID,
    sedeId:
      SEDE_ID,
    nombre:
      "Banco arriendo",
    tipo:
      "BANCO",
    saldoInicial:
      1000000,
    saldoInicialAt:
      new Date(
        ahora.getTime() -
        60 * 60 * 1000
      ),
    createdBy:
      USUARIO_ID
  });

  await crearObligacionRecurrente({
    empresaId:
      EMPRESA_ID,
    sedeId:
      SEDE_ID,
    nombre:
      "Arriendo",
    categoria:
      "ARRIENDO",
    monto:
      700000,
    frecuencia:
      "MENSUAL",
    proximoVencimiento:
      new Date(
        ahora.getTime() +
        20 * 24 * 60 * 60 * 1000
      ),
    fuenteMonto:
      "CONTRATO",
    createdBy:
      USUARIO_ID
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
    resultado.cobertura7Dias,
    "SUFICIENTE"
  );

  assert.equal(
    resultado.grupos
      .dias8a30
      .montoCuantificado,
    700000
  );
});


test("recurrencia mensual en dia 31 cae al ultimo dia valido", () => {
  const obligacion = {
    _id:
      new mongoose.Types.ObjectId(),
    sedeId:
      new mongoose.Types.ObjectId(
        SEDE_ID
      ),
    categoria:
      "DEUDA",
    nombre:
      "Cuota mensual",
    monto:
      100000,
    frecuencia:
      "MENSUAL",
    proximoVencimiento:
      new Date(
        "2026-01-31T00:00:00Z"
      ),
    fechaFin:
      null,
    fuenteMonto:
      "CONTRATO",
    tercero:
      "Banco"
  };

  const items =
    generarVencimientos({
      obligacion,
      desde:
        new Date(
          "2026-01-01T00:00:00Z"
        ),
      hasta:
        new Date(
          "2026-04-01T00:00:00Z"
        )
    });

  assert.deepEqual(
    items.map(
      (item) =>
        item.fechaVencimiento
          .toISOString()
          .slice(0, 10)
    ),
    [
      "2026-01-31",
      "2026-02-28",
      "2026-03-28"
    ]
  );
});
