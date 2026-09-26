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
  normalizarCategoriaObligacion,
  obtenerPoliticaPriorizacionPagos,
  actualizarPoliticaPriorizacionPagos,
  validarPrecedencia
} = require(
  "../../core/finanzas/politicaFinanciera.service"
);

const USUARIO_ID =
  "507f1f77bcf86cd799439703";

function fechaMasDias(base, dias) {
  return new Date(
    base.getTime() +
    dias * 24 * 60 * 60 * 1000
  );
}

async function crearEmpresa(nombre) {
  return Empresa.create({
    empresaId:
      `policy_${nombre}`,
    nombre:
      `Empresa ${nombre}`,
    tipoNegocio:
      "servicios",
    correo:
      `${nombre}@example.com`
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
        "gruk_test_politica_financiera"
    }
  );
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Promise.all([
    Empresa.deleteMany({
      empresaId: /^policy_/
    }),
    Gasto.deleteMany({}),
    CuentaTesoreria.deleteMany({}),
    MovimientoCaja.deleteMany({})
  ]);
});

test("politica nueva empieza desactivada", async () => {
  const empresa =
    await crearEmpresa(
      "default"
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

  assert.deepEqual(
    politica
      .precedencia_categorias,
    []
  );
});

test("normaliza categorias historicas y compras", () => {
  assert.equal(
    normalizarCategoriaObligacion({
      origenTipo: "COMPRA"
    }),
    "PROVEEDORES"
  );

  assert.equal(
    normalizarCategoriaObligacion({
      origenTipo: "GASTO",
      categoria: "Nómina"
    }),
    "NOMINA"
  );

  assert.equal(
    normalizarCategoriaObligacion({
      origenTipo: "GASTO",
      categoria: "Servicios públicos"
    }),
    "SERVICIOS"
  );
});

test("rechaza precedencia duplicada", () => {
  assert.throws(
    () =>
      validarPrecedencia([
        "NOMINA",
        "NOMINA"
      ]),
    /duplicados/
  );
});

test("politica activa cambia orden dentro de proximos 7 dias pero no adelanta una futura sobre una vencida", async () => {
  const ahora = new Date();

  const empresa =
    await crearEmpresa(
      "prioridad"
    );

  await crearCuenta({
    empresaId:
      empresa._id,
    nombre:
      "Banco",
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

  await Gasto.create([
    {
      empresaId:
        empresa._id,
      concepto:
        "Proveedor vencido",
      categoria:
        "Proveedores",
      monto:
        100000,
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
        "Proveedor mañana",
      categoria:
        "Proveedores",
      monto:
        150000,
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
        "Nomina en cinco dias",
      categoria:
        "Nomina",
      monto:
        200000,
      estadoPago:
        "pendiente",
      fechaVencimientoPago:
        fechaMasDias(
          ahora,
          5
        ),
      estado:
        "registrado",
      fecha:
        ahora
    }
  ]);

  await actualizarPoliticaPriorizacionPagos({
    empresaId:
      empresa._id,
    usarPrecedenciaCategoria:
      true,
    precedenciaCategorias: [
      "NOMINA",
      "PROVEEDORES"
    ],
    updatedBy:
      USUARIO_ID
  });

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId:
        empresa._id,
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
      "Proveedor vencido",
      "Nomina en cinco dias",
      "Proveedor mañana"
    ]
  );
});

test("politica apagada conserva prioridad por fecha", async () => {
  const ahora = new Date();

  const empresa =
    await crearEmpresa(
      "apagada"
    );

  await crearCuenta({
    empresaId:
      empresa._id,
    nombre:
      "Banco",
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

  await Gasto.create([
    {
      empresaId:
        empresa._id,
      concepto:
        "Proveedor mañana",
      categoria:
        "Proveedores",
      monto:
        150000,
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
        "Nomina en cinco dias",
      categoria:
        "Nomina",
      monto:
        200000,
      estadoPago:
        "pendiente",
      fechaVencimientoPago:
        fechaMasDias(
          ahora,
          5
        ),
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
      "Proveedor mañana",
      "Nomina en cinco dias"
    ]
  );
});
