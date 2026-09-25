"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Empresa = require("../../models/Empresa");
const Venta = require("../../models/Venta");
const Gasto = require("../../models/Gasto");
const CuentaTesoreria = require(
  "../../core/finanzas/models/CuentaTesoreria"
);
const MovimientoCaja = require(
  "../../core/finanzas/models/MovimientoCaja"
);
const ReservaCaja = require(
  "../../core/finanzas/models/ReservaCaja"
);
const CierreFinancieroMensual = require(
  "../../core/finanzas/models/CierreFinancieroMensual"
);

const {
  crearCuenta
} = require(
  "../../core/finanzas/tesoreria.service"
);

const {
  actualizarPoliticaDistribucionDueno,
  cerrarPeriodoMensual,
  calcularDistribucionDueno,
  crearPropuestaReservaDueno,
  aprobarReservaDueno
} = require(
  "../../core/finanzas/distribucionDueno.service"
);

const {
  construirProyeccionTesoreria
} = require(
  "../../core/finanzas/tesoreriaProyeccion.service"
);

const USUARIO_ID =
  "507f1f77bcf86cd799439803";

let empresa;

function periodoAnterior() {
  const ahora = new Date();
  const fin =
    new Date(
      Date.UTC(
        ahora.getUTCFullYear(),
        ahora.getUTCMonth(),
        1
      )
    );

  const inicio =
    new Date(
      Date.UTC(
        fin.getUTCFullYear(),
        fin.getUTCMonth() - 1,
        1
      )
    );

  return {
    periodo:
      `${inicio.getUTCFullYear()}-${String(
        inicio.getUTCMonth() + 1
      ).padStart(2, "0")}`,
    fechaVenta:
      new Date(
        Date.UTC(
          inicio.getUTCFullYear(),
          inicio.getUTCMonth(),
          10,
          12
        )
      ),
    fechaGasto:
      new Date(
        Date.UTC(
          inicio.getUTCFullYear(),
          inicio.getUTCMonth(),
          15,
          12
        )
      )
  };
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

async function crearEscenarioConfiable({
  saldo = 2000000
} = {}) {
  const periodo =
    periodoAnterior();

  await crearCuenta({
    empresaId:
      empresa._id,
    sedeId:
      null,
    nombre:
      "Banco principal",
    tipo:
      "BANCO",
    saldoInicial:
      saldo,
    saldoInicialAt:
      new Date(
        Date.now() -
        24 * 60 * 60 * 1000
      ),
    createdBy:
      USUARIO_ID
  });

  await Venta.create({
    empresaId:
      empresa._id,
    sedeId:
      null,
    concepto:
      "Venta confiable",
    cantidad:
      1,
    precioUnitario:
      1000000,
    costoUnitario:
      400000,
    costoTotal:
      400000,
    utilidadBruta:
      600000,
    margenBruto:
      60,
    total:
      1000000,
    estado:
      "pagada",
    fecha:
      periodo.fechaVenta,
    metadata: {
      costoCongelado:
        true
    }
  });

  await Gasto.create({
    empresaId:
      empresa._id,
    sedeId:
      null,
    concepto:
      "Administracion",
    categoria:
      "Administracion",
    monto:
      200000,
    estadoPago:
      "pagado",
    estado:
      "registrado",
    fecha:
      periodo.fechaGasto
  });

  return periodo;
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
        "gruk_test_distribucion_dueno"
    }
  );
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Promise.all([
    Empresa.deleteMany({}),
    Venta.deleteMany({}),
    Gasto.deleteMany({}),
    CuentaTesoreria.deleteMany({}),
    MovimientoCaja.deleteMany({}),
    ReservaCaja.deleteMany({}),
    CierreFinancieroMensual.deleteMany({})
  ]);

  empresa =
    await nuevaEmpresa();
});

test("cierre parcial no permite calcular ganancia del dueno", async () => {
  const periodo =
    periodoAnterior();

  await Venta.create({
    empresaId:
      empresa._id,
    concepto:
      "Venta sin costo confiable",
    cantidad:
      1,
    precioUnitario:
      500000,
    total:
      500000,
    estado:
      "pagada",
    fecha:
      periodo.fechaVenta,
    metadata: {
      costoCongelado:
        false
    }
  });

  await actualizarPoliticaDistribucionDueno({
    empresaId:
      empresa._id,
    habilitada:
      true,
    porcentajeUtilidad:
      50,
    reservaMinimaCaja:
      0,
    updatedBy:
      USUARIO_ID
  });

  const cierre =
    await cerrarPeriodoMensual({
      empresaId:
        empresa._id,
      periodo:
        periodo.periodo,
      createdBy:
        USUARIO_ID
    });

  assert.equal(
    cierre.estadoConfiabilidad,
    "PARCIAL"
  );

  const calculo =
    await calcularDistribucionDueno({
      empresaId:
        empresa._id,
      cierreId:
        cierre._id
    });

  assert.equal(
    calculo.estado,
    "CIERRE_NO_CONFIABLE"
  );

  assert.equal(
    calculo.montoPropuesto,
    0
  );
});

test("utilidad confiable se limita por porcentaje y caja libre", async () => {
  const periodo =
    await crearEscenarioConfiable();

  await actualizarPoliticaDistribucionDueno({
    empresaId:
      empresa._id,
    habilitada:
      true,
    porcentajeUtilidad:
      50,
    reservaMinimaCaja:
      100000,
    updatedBy:
      USUARIO_ID
  });

  const cierre =
    await cerrarPeriodoMensual({
      empresaId:
        empresa._id,
      periodo:
        periodo.periodo,
      createdBy:
        USUARIO_ID
    });

  assert.equal(
    cierre.estadoConfiabilidad,
    "COMPLETO"
  );

  assert.equal(
    cierre.utilidadOperacionalConfiable,
    400000
  );

  const calculo =
    await calcularDistribucionDueno({
      empresaId:
        empresa._id,
      cierreId:
        cierre._id
    });

  assert.equal(
    calculo.estado,
    "DISTRIBUIBLE"
  );

  assert.equal(
    calculo.derechoTeoricoDueno,
    200000
  );

  assert.equal(
    calculo.montoPropuesto,
    200000
  );
});

test("aprobar reserva del dueno reduce caja operativa pero no saldo bancario", async () => {
  const periodo =
    await crearEscenarioConfiable();

  await actualizarPoliticaDistribucionDueno({
    empresaId:
      empresa._id,
    habilitada:
      true,
    porcentajeUtilidad:
      50,
    reservaMinimaCaja:
      100000,
    updatedBy:
      USUARIO_ID
  });

  const cierre =
    await cerrarPeriodoMensual({
      empresaId:
        empresa._id,
      periodo:
        periodo.periodo,
      createdBy:
        USUARIO_ID
    });

  const propuesta =
    await crearPropuestaReservaDueno({
      empresaId:
        empresa._id,
      cierreId:
        cierre._id,
      createdBy:
        USUARIO_ID
    });

  assert.equal(
    propuesta.reserva.estado,
    "PROPUESTA"
  );

  const aprobada =
    await aprobarReservaDueno({
      empresaId:
        empresa._id,
      reservaId:
        propuesta.reserva._id,
      approvedBy:
        USUARIO_ID
    });

  assert.equal(
    aprobada.estado,
    "ACTIVA"
  );

  const proyeccion =
    await construirProyeccionTesoreria({
      empresaId:
        empresa._id
    });

  assert.equal(
    proyeccion.saldoActual,
    2000000
  );

  assert.equal(
    proyeccion
      .reservasActivas
      .utilidadDueno,
    200000
  );

  assert.equal(
    proyeccion
      .saldoLibreOperativo,
    1800000
  );
});

test("aprobacion se rechaza si la caja libre cambia despues de la propuesta", async () => {
  const periodo =
    await crearEscenarioConfiable({
      saldo:
        500000
    });

  await actualizarPoliticaDistribucionDueno({
    empresaId:
      empresa._id,
    habilitada:
      true,
    porcentajeUtilidad:
      50,
    reservaMinimaCaja:
      100000,
    updatedBy:
      USUARIO_ID
  });

  const cierre =
    await cerrarPeriodoMensual({
      empresaId:
        empresa._id,
      periodo:
        periodo.periodo,
      createdBy:
        USUARIO_ID
    });

  const propuesta =
    await crearPropuestaReservaDueno({
      empresaId:
        empresa._id,
      cierreId:
        cierre._id,
      createdBy:
        USUARIO_ID
    });

  await ReservaCaja.create({
    empresaId:
      empresa._id,
    sedeId:
      null,
    categoria:
      "COLCHON_OPERATIVO",
    monto:
      250000,
    estado:
      "ACTIVA",
    origenTipo:
      "MANUAL",
    origenId:
      null,
    concepto:
      "Reserva operativa posterior",
    createdBy:
      USUARIO_ID,
    approvedBy:
      USUARIO_ID,
    approvedAt:
      new Date(),
    deletedAt:
      null
  });

  await assert.rejects(
    () =>
      aprobarReservaDueno({
        empresaId:
          empresa._id,
        reservaId:
          propuesta.reserva._id,
        approvedBy:
          USUARIO_ID
      }),
    /ya no soporta esta reserva/
  );
});
