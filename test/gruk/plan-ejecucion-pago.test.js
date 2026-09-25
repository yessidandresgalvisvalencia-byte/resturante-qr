"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Decision = require(
  "../../intelligence/models/CerebroDecision"
);
const PlanEjecucionPago = require(
  "../../core/finanzas/models/PlanEjecucionPago"
);
const {
  crearPlanDesdeDecision
} = require(
  "../../core/finanzas/planEjecucionPago.service"
);
const {
  obtenerPlanesPagoDecision
} = require(
  "../../intelligence/brain/cerebro.service"
);
const {
  ROLES_GRUK
} = require(
  "../../core/auth/roleCheck.middleware"
);

const EMPRESA_ID =
  "507f1f77bcf86cd799439901";
const OTRA_EMPRESA_ID =
  "507f1f77bcf86cd799439902";
const USUARIO_ID =
  "507f1f77bcf86cd799439903";

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
        "gruk_test_plan_ejecucion_pago"
    }
  );
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Promise.all([
    Decision.deleteMany({}),
    PlanEjecucionPago.deleteMany({})
  ]);
});

function decisionBase() {
  const decisionId =
    new mongoose.Types.ObjectId();

  const ordenId =
    new mongoose.Types.ObjectId();

  return {
    _id:
      decisionId,
    empresaId:
      new mongoose.Types.ObjectId(
        EMPRESA_ID
      ),
    sedeId: null,
    contexto_financiero: {
      saldoActual:
        250000,
      planPagosCajaActual: [
        {
          _id:
            new mongoose.Types.ObjectId(),
          origenId:
            new mongoose.Types.ObjectId(),
          tipo:
            "GASTO",
          descripcion:
            "Nomina",
          monto:
            150000,
          fechaVencimiento:
            new Date(),
          estadoCobertura:
            "CUBIERTA"
        },
        {
          _id:
            new mongoose.Types.ObjectId(),
          origenId:
            new mongoose.Types.ObjectId(),
          tipo:
            "COMPRA",
          descripcion:
            "Proveedor no cubierto",
          monto:
            200000,
          fechaVencimiento:
            new Date(),
          estadoCobertura:
            "NO_CUBIERTA"
        },
        {
          _id:
            new mongoose.Types.ObjectId(),
          origenId:
            new mongoose.Types.ObjectId(),
          tipo:
            "RECURRENTE",
          descripcion:
            "Servicio",
          monto:
            50000,
          fechaVencimiento:
            new Date(),
          estadoCobertura:
            "CUBIERTA"
        }
      ]
    },
    ordenes_por_departamento: [
      {
        _id:
          ordenId,
        departamento:
          "DIRECCION",
        tarea:
          "Priorizar pagos",
        prioridad:
          "CRITICA",
        kpi_a_medir:
          "obligaciones_7d_cubiertas",
        automatizable:
          false
      }
    ]
  };
}

test("plan aprobado solo incluye obligaciones cubiertas con caja actual", async () => {
  const decision =
    decisionBase();

  const orden =
    decision
      .ordenes_por_departamento[0];

  const plan =
    await crearPlanDesdeDecision({
      decision,
      orden,
      createdBy:
        new mongoose.Types.ObjectId(
          USUARIO_ID
        )
    });

  assert.ok(plan);

  assert.equal(
    plan.items.length,
    2
  );

  assert.deepEqual(
    plan.items.map(
      (item) =>
        item.descripcion
    ),
    [
      "Nomina",
      "Servicio"
    ]
  );

  assert.equal(
    plan.totalAutorizado,
    200000
  );

  assert.equal(
    plan.saldoDisponibleSnapshot,
    250000
  );

  assert.equal(
    plan.items.some(
      (item) =>
        item.descripcion ===
        "Proveedor no cubierto"
    ),
    false
  );
});

test("orden no financiera no crea plan de ejecucion", async () => {
  const decision =
    decisionBase();

  const orden = {
    _id:
      new mongoose.Types.ObjectId(),
    kpi_a_medir:
      "cac"
  };

  const plan =
    await crearPlanDesdeDecision({
      decision,
      orden,
      createdBy:
        new mongoose.Types.ObjectId(
          USUARIO_ID
        )
    });

  assert.equal(
    plan,
    null
  );

  assert.equal(
    await PlanEjecucionPago.countDocuments({}),
    0
  );
});

test("Cerebro no expone planes de pago de otro tenant", async () => {
  const d =
    await Decision.create({
      empresaId:
        EMPRESA_ID,
      sedeId: null,
      decision_general: {
        situacion:
          "Prueba",
        causa_raiz:
          "Prueba",
        prediccion:
          "Prueba"
      },
      ordenes_por_departamento: [],
      confianza_global:
        80,
      riesgo_si_no_se_hace:
        "Prueba",
      como_medir_exito_en_7_dias:
        "Prueba",
      reportesOrigen: [],
      createdBy: null,
      deletedAt: null
    });

  await PlanEjecucionPago.create({
    empresaId:
      EMPRESA_ID,
    sedeId: null,
    decisionId:
      d._id,
    ordenId:
      new mongoose.Types.ObjectId(),
    saldoDisponibleSnapshot:
      100000,
    totalAutorizado:
      50000,
    items: [
      {
        origenTipo:
          "GASTO",
        origenId:
          new mongoose.Types.ObjectId(),
        descripcion:
          "Pago prueba",
        monto:
          50000,
        estado:
          "PENDIENTE_CONFIRMACION"
      }
    ],
    createdBy:
      USUARIO_ID,
    deletedAt: null
  });

  const propios =
    await obtenerPlanesPagoDecision(
      {
        usuarioId:
          USUARIO_ID,
        empresaId:
          EMPRESA_ID,
        sedeId: null,
        rol:
          ROLES_GRUK.DUENO
      },
      String(d._id)
    );

  assert.equal(
    propios.length,
    1
  );

  await assert.rejects(
    () =>
      obtenerPlanesPagoDecision(
        {
          usuarioId:
            USUARIO_ID,
          empresaId:
            OTRA_EMPRESA_ID,
          sedeId: null,
          rol:
            ROLES_GRUK.DUENO
        },
        String(d._id)
      ),
    (error) =>
      error.statusCode === 404
  );
});
