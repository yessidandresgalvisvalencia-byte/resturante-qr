"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Empresa = require("../../models/Empresa");
const Gasto = require("../../models/Gasto");
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
  construirProyeccionTesoreria
} = require(
  "../../core/finanzas/tesoreriaProyeccion.service"
);

const {
  crearExcepcionPrioridadPago,
  revocarExcepcionPrioridadPago,
  listarExcepcionesActivas
} = require(
  "../../core/finanzas/excepcionesPrioridadPago.service"
);

const USUARIO_ID =
  "507f1f77bcf86cd799439803";

function fechaMasDias(base, dias) {
  return new Date(
    base.getTime() +
    dias * 24 * 60 * 60 * 1000
  );
}

async function crearEmpresa(nombre) {
  return Empresa.create({
    empresaId:
      `exception_${nombre}`,
    nombre:
      `Empresa ${nombre}`,
    tipoNegocio:
      "servicios",
    correo:
      `${nombre}@exception.test`
  });
}

async function crearBanco(
  empresaId,
  ahora
) {
  await crearCuenta({
    empresaId,
    nombre:
      "Banco excepciones",
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
        "gruk_test_excepciones_prioridad"
    }
  );
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Promise.all([
    Empresa.deleteMany({
      empresaId:
        /^exception_/
    }),
    Gasto.deleteMany({}),
    CuentaTesoreria.deleteMany({}),
    MovimientoCaja.deleteMany({}),
    ExcepcionPrioridadPago.deleteMany({})
  ]);
});

test("excepcion activa adelanta obligacion dentro de proximos 7 dias", async () => {
  const ahora = new Date();
  const empresa =
    await crearEmpresa(
      "activa"
    );

  await crearBanco(
    empresa._id,
    ahora
  );

  const [primero, segundo] =
    await Gasto.create([
      {
        empresaId:
          empresa._id,
        concepto:
          "Proveedor mañana",
        categoria:
          "Proveedores",
        monto:
          100000,
        estadoPago:
          "pendiente",
        fechaVencimientoPago:
          fechaMasDias(
            ahora,
            1
          ),
        estado:
          "registrado",
        fecha:
          ahora
      },
      {
        empresaId:
          empresa._id,
        concepto:
          "Proveedor excepcional",
        categoria:
          "Proveedores",
        monto:
          90000,
        estadoPago:
          "pendiente",
        fechaVencimientoPago:
          fechaMasDias(
            ahora,
            4
          ),
        estado:
          "registrado",
        fecha:
          ahora
      }
    ]);

  await crearExcepcionPrioridadPago({
    empresaId:
      empresa._id,
    origenTipo:
      "GASTO",
    origenId:
      segundo._id,
    motivo:
      "Si no se paga se detiene una entrega operativa confirmada.",
    expiresAt:
      new Date(
        Date.now() +
        24 * 60 * 60 * 1000
      ),
    createdBy:
      USUARIO_ID
  });

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId:
        empresa._id,
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
      "Proveedor excepcional",
      "Proveedor mañana"
    ]
  );

  assert.ok(
    proyeccion
      .obligaciones
      .prioridadPago[0]
      .excepcionPrioridad
  );

  assert.equal(
    String(
      primero._id
    ) ===
    String(
      proyeccion
        .obligaciones
        .prioridadPago[0]
        .id
    ),
    false
  );
});

test("excepcion futura nunca adelanta una obligacion sobre otra ya vencida", async () => {
  const ahora = new Date();
  const empresa =
    await crearEmpresa(
      "frontera"
    );

  await crearBanco(
    empresa._id,
    ahora
  );

  const [vencida, futura] =
    await Gasto.create([
      {
        empresaId:
          empresa._id,
        concepto:
          "Obligacion vencida",
        categoria:
          "Servicios",
        monto:
          50000,
        estadoPago:
          "pendiente",
        fechaVencimientoPago:
          fechaMasDias(
            ahora,
            -1
          ),
        estado:
          "registrado",
        fecha:
          ahora
      },
      {
        empresaId:
          empresa._id,
        concepto:
          "Obligacion futura con excepcion",
        categoria:
          "Nomina",
        monto:
          300000,
        estadoPago:
          "pendiente",
        fechaVencimientoPago:
          fechaMasDias(
            ahora,
            3
          ),
        estado:
          "registrado",
        fecha:
          ahora
      }
    ]);

  await crearExcepcionPrioridadPago({
    empresaId:
      empresa._id,
    origenTipo:
      "GASTO",
    origenId:
      futura._id,
    motivo:
      "Excepcion temporal aprobada por continuidad operativa documentada.",
    expiresAt:
      new Date(
        Date.now() +
        24 * 60 * 60 * 1000
      ),
    createdBy:
      USUARIO_ID
  });

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId:
        empresa._id,
      ahora
    });

  assert.equal(
    String(
      proyeccion
        .obligaciones
        .prioridadPago[0]
        .id
    ),
    String(
      vencida._id
    )
  );
});

test("excepcion expirada no participa en prioridad", async () => {
  const ahora = new Date();
  const empresa =
    await crearEmpresa(
      "expirada"
    );

  await ExcepcionPrioridadPago.create({
    empresaId:
      empresa._id,
    origenTipo:
      "GASTO",
    origenId:
      new mongoose.Types.ObjectId(),
    motivo:
      "Excepcion histórica ya expirada para prueba de filtrado.",
    expiresAt:
      new Date(
        ahora.getTime() -
        60 * 1000
      ),
    createdBy:
      USUARIO_ID,
    revokedAt:
      null,
    deletedAt:
      null
  });

  const activas =
    await listarExcepcionesActivas({
      empresaId:
        empresa._id,
      ahora
    });

  assert.equal(
    activas.length,
    0
  );
});

test("revocar conserva documento historico y lo saca de activas", async () => {
  const empresa =
    await crearEmpresa(
      "revocada"
    );

  const excepcion =
    await crearExcepcionPrioridadPago({
      empresaId:
        empresa._id,
      origenTipo:
        "GASTO",
      origenId:
        new mongoose.Types.ObjectId(),
      motivo:
        "Excepcion temporal que sera revocada conservando auditoria.",
      expiresAt:
        new Date(
          Date.now() +
          24 * 60 * 60 * 1000
        ),
      createdBy:
        USUARIO_ID
    });

  await revocarExcepcionPrioridadPago({
    empresaId:
      empresa._id,
    excepcionId:
      excepcion._id,
    revokedBy:
      USUARIO_ID
  });

  const guardada =
    await ExcepcionPrioridadPago.findById(
      excepcion._id
    ).lean();

  assert.ok(
    guardada
      .revokedAt
  );

  assert.equal(
    String(
      guardada
        .revokedBy
    ),
    USUARIO_ID
  );

  const activas =
    await listarExcepcionesActivas({
      empresaId:
        empresa._id
    });

  assert.equal(
    activas.length,
    0
  );
});
