"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Empresa = require("../../models/Empresa");
const Inventario = require("../../models/Inventario");
const Venta = require("../../models/Venta");
const Gasto = require("../../models/Gasto");
const Reporte = require(
  "../../intelligence/models/CerebroReporteNeurona"
);

const finanzas = require(
  "../../intelligence/neurons/finanzas.neuron"
);
const ventas = require(
  "../../intelligence/neurons/ventas.neuron"
);
const marketing = require(
  "../../intelligence/neurons/marketing.neuron"
);
const operaciones = require(
  "../../intelligence/neurons/operaciones.neuron"
);
const gente = require(
  "../../intelligence/neurons/gente.neuron"
);

const USER_ID =
  "507f1f77bcf86cd799439a03";

let empresa;

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
      `${sufijo}@example.com`,
    estado:
      "activa"
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
        "gruk_test_evaluabilidad_neuronas"
    }
  );
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Promise.all([
    Empresa.deleteMany({}),
    Inventario.deleteMany({}),
    Venta.deleteMany({}),
    Gasto.deleteMany({}),
    Reporte.deleteMany({})
  ]);

  empresa =
    await nuevaEmpresa();
});

test("empresa sin setup no genera falsas alertas operativas", async () => {
  const reportes = await Promise.all([
    finanzas.analyze(
      empresa._id
    ),
    ventas.analyze(
      empresa._id
    ),
    marketing.analyze(
      empresa._id
    ),
    operaciones.analyze(
      empresa._id
    ),
    gente.analyze(
      empresa._id
    )
  ]);

  const porNeurona =
    new Map(
      reportes.map(
        (item) => [
          item.neurona,
          item.kpi_principal
        ]
      )
    );

  assert.equal(
    porNeurona.get("FINANZAS")
      .estado,
    "SIN_CONFIGURAR"
  );

  assert.equal(
    porNeurona.get("VENTAS")
      .estado,
    "SIN_CONFIGURAR"
  );

  assert.equal(
    porNeurona.get("MARKETING")
      .estado,
    "SIN_CONFIGURAR"
  );

  assert.equal(
    porNeurona.get("OPERACIONES")
      .estado,
    "DATOS_INSUFICIENTES"
  );

  assert.equal(
    porNeurona.get("GENTE")
      .estado,
    "SIN_CONFIGURAR"
  );

  assert.equal(
    reportes.some(
      (item) =>
        item.kpi_principal
          .estado === "ALERTA" ||
        item.kpi_principal
          .estado === "CRITICO"
    ),
    false
  );

  assert.ok(
    reportes.every(
      (item) =>
        item.necesita_decision_de_cerebro ===
        false
    )
  );
});

test("configurar objetivos no inventa mediciones que aun no existen", async () => {
  await Empresa.updateOne(
    {
      _id:
        empresa._id
    },
    {
      $set: {
        "configuracion.margen_objetivo":
          35,
        "configuracion.punto_equilibrio":
          10000000,
        "configuracion.ticket_objetivo":
          30000,
        "configuracion.cac_maximo":
          12000,
        "configuracion.empleados_actuales":
          8,
        "configuracion.inteligencia_base_actualizadaAt":
          new Date(),
        "configuracion.inteligencia_base_actualizadaBy":
          new mongoose.Types.ObjectId(
            USER_ID
          )
      }
    }
  );

  const reportes =
    await Promise.all([
      finanzas.analyze(
        empresa._id
      ),
      ventas.analyze(
        empresa._id
      ),
      marketing.analyze(
        empresa._id
      ),
      gente.analyze(
        empresa._id
      )
    ]);

  const porNeurona =
    new Map(
      reportes.map(
        (item) => [
          item.neurona,
          item.kpi_principal
        ]
      )
    );

  assert.equal(
    porNeurona.get("FINANZAS")
      .estado,
    "DATOS_INSUFICIENTES"
  );

  assert.equal(
    porNeurona.get("VENTAS")
      .estado,
    "DATOS_INSUFICIENTES"
  );

  assert.equal(
    porNeurona.get("MARKETING")
      .estado,
    "DATOS_INSUFICIENTES"
  );

  assert.equal(
    porNeurona.get("GENTE")
      .estado,
    "OK"
  );

  assert.equal(
    porNeurona.get("GENTE")
      .valor_actual,
    8
  );
});
