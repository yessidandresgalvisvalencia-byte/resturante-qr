"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Empresa = require("../../models/Empresa");
const Gasto = require("../../models/Gasto");
const Compra = require("../../models/Compra");
const Venta = require("../../models/Venta");
const CuentaTesoreria = require(
  "../../core/finanzas/models/CuentaTesoreria"
);
const MovimientoCaja = require(
  "../../core/finanzas/models/MovimientoCaja"
);
const ExcepcionPrioridadPago = require(
  "../../core/finanzas/models/ExcepcionPrioridadPago"
);

const {
  crearCuenta
} = require(
  "../../core/finanzas/tesoreria.service"
);

const {
  actualizarPoliticaPriorizacionPagos,
  obtenerPoliticaPriorizacionPagos
} = require(
  "../../core/finanzas/politicaFinanciera.service"
);

const {
  crearExcepcionPrioridadPago,
  revocarExcepcionPrioridadPago,
  listarExcepcionesActivas
} = require(
  "../../core/finanzas/excepcionesPrioridadPago.service"
);

const {
  construirProyeccionTesoreria
} = require(
  "../../core/finanzas/tesoreriaProyeccion.service"
);

const USUARIO_ID =
  "507f1f77bcf86cd799439703";

let empresa;
let sedeId;

function masDias(fecha, dias) {
  return new Date(
    fecha.getTime() +
    dias * 24 * 60 * 60 * 1000
  );
}

async function nuevaEmpresa() {
  const sufijo =
    new mongoose.Types.ObjectId()
      .toString()
      .slice(-8);

  return Empresa.create({
    empresaId:
      `empresa-${sufijo}`,
    nombre:
      `Empresa ${sufijo}`,
    tipoNegocio:
      "restaurante",
    correo:
      `${sufijo}@example.com`
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
        "gruk_test_politica_pagos"
    }
  );
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Promise.all([
    Empresa.deleteMany({}),
    Gasto.deleteMany({}),
    Compra.deleteMany({}),
    Venta.deleteMany({}),
    CuentaTesoreria.deleteMany({}),
    MovimientoCaja.deleteMany({}),
    ExcepcionPrioridadPago.deleteMany({})
  ]);

  empresa =
    await nuevaEmpresa();

  sedeId =
    new mongoose.Types.ObjectId();

  const ahora =
    new Date();

  await crearCuenta({
    empresaId:
      empresa._id,
    sedeId,
    nombre:
      "Banco prueba",
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
});

test("politica desactivada mantiene vencimiento como criterio principal", async () => {
  const ahora =
    new Date();

  await Gasto.create([
    {
      empresaId:
        empresa._id,
      sedeId,
      concepto:
        "Servicio primero",
      categoria:
        "Servicios",
      monto:
        100000,
      estadoPago:
        "pendiente",
      fechaVencimientoPago:
        masDias(ahora, 1),
      estado:
        "registrado",
      fecha:
        ahora
    },
    {
      empresaId:
        empresa._id,
      sedeId,
      concepto:
        "Nomina despues",
      categoria:
        "Nomina",
      monto:
        200000,
      estadoPago:
        "pendiente",
      fechaVencimientoPago:
        masDias(ahora, 3),
      estado:
        "registrado",
      fecha:
        ahora
    }
  ]);

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId:
        empresa._id,
      sedeId,
      ahora
    });

  assert.deepEqual(
    proyeccion
      .obligaciones
      .prioridadPago
      .map(
        (item) =>
          item.descripcion
      ),
    [
      "Servicio primero",
      "Nomina despues"
    ]
  );
});

test("politica activa aplica precedencia dentro del mismo bloque temporal", async () => {
  const ahora =
    new Date();

  await actualizarPoliticaPriorizacionPagos({
    empresaId:
      empresa._id,
    usarPrecedenciaCategoria:
      true,
    precedenciaCategorias: [
      "NOMINA",
      "IMPUESTOS",
      "SERVICIOS"
    ],
    updatedBy:
      USUARIO_ID
  });

  await Gasto.create([
    {
      empresaId:
        empresa._id,
      sedeId,
      concepto:
        "Servicio primero por fecha",
      categoria:
        "Servicios",
      monto:
        100000,
      estadoPago:
        "pendiente",
      fechaVencimientoPago:
        masDias(ahora, 1),
      estado:
        "registrado",
      fecha:
        ahora
    },
    {
      empresaId:
        empresa._id,
      sedeId,
      concepto:
        "Nomina corporativa",
      categoria:
        "Nomina",
      monto:
        200000,
      estadoPago:
        "pendiente",
      fechaVencimientoPago:
        masDias(ahora, 3),
      estado:
        "registrado",
      fecha:
        ahora
    }
  ]);

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId:
        empresa._id,
      sedeId,
      ahora
    });

  assert.equal(
    proyeccion
      .politicaPriorizacionPagos
      .usar_precedencia_categoria,
    true
  );

  assert.deepEqual(
    proyeccion
      .obligaciones
      .prioridadPago
      .map(
        (item) =>
          item.descripcion
      ),
    [
      "Nomina corporativa",
      "Servicio primero por fecha"
    ]
  );
});

test("politica nunca desplaza una obligacion ya vencida con otra futura", async () => {
  const ahora =
    new Date();

  await actualizarPoliticaPriorizacionPagos({
    empresaId:
      empresa._id,
    usarPrecedenciaCategoria:
      true,
    precedenciaCategorias: [
      "NOMINA",
      "SERVICIOS"
    ],
    updatedBy:
      USUARIO_ID
  });

  await Gasto.create([
    {
      empresaId:
        empresa._id,
      sedeId,
      concepto:
        "Servicio vencido",
      categoria:
        "Servicios",
      monto:
        80000,
      estadoPago:
        "pendiente",
      fechaVencimientoPago:
        masDias(ahora, -1),
      estado:
        "registrado",
      fecha:
        ahora
    },
    {
      empresaId:
        empresa._id,
      sedeId,
      concepto:
        "Nomina futura",
      categoria:
        "Nomina",
      monto:
        300000,
      estadoPago:
        "pendiente",
      fechaVencimientoPago:
        masDias(ahora, 2),
      estado:
        "registrado",
      fecha:
        ahora
    }
  ]);

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId:
        empresa._id,
      sedeId,
      ahora
    });

  assert.deepEqual(
    proyeccion
      .obligaciones
      .prioridadPago
      .map(
        (item) =>
          item.descripcion
      ),
    [
      "Servicio vencido",
      "Nomina futura"
    ]
  );
});

test("excepcion temporal sube una obligacion concreta sin modificar politica base", async () => {
  const ahora =
    new Date();

  const [primero, segundo] =
    await Gasto.create([
      {
        empresaId:
          empresa._id,
        sedeId,
        concepto:
          "Pago normal primero",
        categoria:
          "Servicios",
        monto:
          100000,
        estadoPago:
          "pendiente",
        fechaVencimientoPago:
          masDias(ahora, 1),
        estado:
          "registrado",
        fecha:
          ahora
      },
      {
        empresaId:
          empresa._id,
        sedeId,
        concepto:
          "Pago excepcional",
        categoria:
          "Otro",
        monto:
          90000,
        estadoPago:
          "pendiente",
        fechaVencimientoPago:
          masDias(ahora, 4),
        estado:
          "registrado",
        fecha:
          ahora
      }
    ]);

  await crearExcepcionPrioridadPago({
    empresaId:
      empresa._id,
    sedeId,
    origenTipo:
      "GASTO",
    origenId:
      segundo._id,
    motivo:
      "Compromiso contractual documentado por direccion",
    expiresAt:
      masDias(ahora, 1),
    createdBy:
      USUARIO_ID
  });

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId:
        empresa._id,
      sedeId,
      ahora
    });

  assert.deepEqual(
    proyeccion
      .obligaciones
      .prioridadPago
      .map(
        (item) =>
          item.descripcion
      ),
    [
      "Pago excepcional",
      "Pago normal primero"
    ]
  );

  const politica =
    await obtenerPoliticaPriorizacionPagos(
      empresa._id
    );

  assert.equal(
    politica
      .usar_precedencia_categoria,
    false
  );

  assert.equal(
    String(primero._id).length,
    24
  );
});

test("excepcion expirada deja de participar y revocacion la elimina de activas", async () => {
  const ahora =
    new Date();

  const gasto =
    await Gasto.create({
      empresaId:
        empresa._id,
      sedeId,
      concepto:
        "Obligacion temporal",
      categoria:
        "Otro",
      monto:
        100000,
      estadoPago:
        "pendiente",
      fechaVencimientoPago:
        masDias(ahora, 2),
      estado:
        "registrado",
      fecha:
        ahora
    });

  await ExcepcionPrioridadPago.create({
    empresaId:
      empresa._id,
    sedeId,
    origenTipo:
      "GASTO",
    origenId:
      gasto._id,
    motivo:
      "Excepcion historica ya expirada",
    expiresAt:
      masDias(ahora, -1),
    createdBy:
      USUARIO_ID,
    revokedAt:
      null,
    revokedBy:
      null,
    deletedAt:
      null
  });

  assert.equal(
    (
      await listarExcepcionesActivas({
        empresaId:
          empresa._id,
        sedeId,
        ahora
      })
    ).length,
    0
  );

  const activa =
    await crearExcepcionPrioridadPago({
      empresaId:
        empresa._id,
      sedeId,
      origenTipo:
        "GASTO",
      origenId:
        gasto._id,
      motivo:
        "Excepcion temporal aprobada por el dueno",
      expiresAt:
        masDias(ahora, 1),
      createdBy:
        USUARIO_ID
    });

  assert.equal(
    (
      await listarExcepcionesActivas({
        empresaId:
          empresa._id,
        sedeId,
        ahora
      })
    ).length,
    1
  );

  await revocarExcepcionPrioridadPago({
    empresaId:
      empresa._id,
    excepcionId:
      activa._id,
    revokedBy:
      USUARIO_ID
  });

  assert.equal(
    (
      await listarExcepcionesActivas({
        empresaId:
          empresa._id,
        sedeId,
        ahora
      })
    ).length,
    0
  );
});
