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
const MovimientoCaja = require(
  "../../core/finanzas/models/MovimientoCaja"
);
const {
  crearPlanDesdeDecision,
  confirmarItemPagado
} = require(
  "../../core/finanzas/planEjecucionPago.service"
);
const {
  obtenerPlanesPagoDecision,
  obtenerAuditoria
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
    PlanEjecucionPago.deleteMany({}),
    MovimientoCaja.deleteMany({})
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


async function crearSalidaCaja({
  origenTipo,
  origenId,
  movimientoOriginalId = null,
  tipoAsiento = "CONFIRMACION"
}) {
  return MovimientoCaja.create({
    empresaId:
      EMPRESA_ID,
    sedeId: null,
    cuentaTesoreriaId: null,
    estadoAsignacionCuenta:
      "SIN_ASIGNAR",
    direccion:
      "SALIDA",
    monto:
      150000,
    moneda:
      "COP",
    origenTipo,
    origenId,
    tipoAsiento,
    movimientoOriginalId,
    concepto:
      "Pago prueba",
    metodoPago:
      "transferencia",
    claveIdempotencia:
      `PLAN_TEST:${new mongoose.Types.ObjectId()}`,
    referenciaEconomica:
      null,
    confirmadoAt:
      new Date(),
    metadata: {},
    createdBy:
      USUARIO_ID,
    deletedAt:
      null
  });
}

test("confirmacion de plan exige salida real no revertida en Caja", async () => {
  const decision =
    decisionBase();

  const plan =
    await crearPlanDesdeDecision({
      decision,
      orden:
        decision
          .ordenes_por_departamento[0],
      createdBy:
        new mongoose.Types.ObjectId(
          USUARIO_ID
        )
    });

  const gasto =
    plan.items.find(
      (item) =>
        item.origenTipo ===
        "GASTO"
    );

  await assert.rejects(
    () =>
      confirmarItemPagado({
        empresaId:
          EMPRESA_ID,
        planId:
          plan._id,
        itemId:
          gasto._id,
        confirmadoBy:
          USUARIO_ID
      }),
    (error) =>
      error.statusCode === 409
  );

  const movimiento =
    await crearSalidaCaja({
      origenTipo:
        "GASTO",
      origenId:
        gasto.origenId
    });

  const confirmado =
    await confirmarItemPagado({
      empresaId:
        EMPRESA_ID,
      planId:
        plan._id,
      itemId:
        gasto._id,
      confirmadoBy:
        USUARIO_ID
    });

  const item =
    confirmado.items.find(
      (x) =>
        String(x._id) ===
        String(gasto._id)
    );

  assert.equal(
    item.estado,
    "CONFIRMADO"
  );

  assert.equal(
    String(
      item.movimientoCajaId
    ),
    String(
      movimiento._id
    )
  );

  assert.ok(
    item.confirmadoAt
  );

  const auditoria =
    await obtenerAuditoria(
      {
        usuarioId:
          USUARIO_ID,
        empresaId:
          EMPRESA_ID,
        sedeId:
          null,
        rol:
          ROLES_GRUK.DUENO
      },
      100
    );

  assert.ok(
    auditoria.some(
      (evento) =>
        evento.accion ===
        "PLAN_PAGO_CREADO"
    )
  );

  assert.ok(
    auditoria.some(
      (evento) =>
        evento.accion ===
        "PAGO_VERIFICADO_EN_CAJA" &&
        String(
          evento.movimientoCajaId
        ) ===
        String(
          movimiento._id
        )
    )
  );
});

test("salida revertida no confirma item del plan", async () => {
  const decision =
    decisionBase();

  const plan =
    await crearPlanDesdeDecision({
      decision,
      orden:
        decision
          .ordenes_por_departamento[0],
      createdBy:
        new mongoose.Types.ObjectId(
          USUARIO_ID
        )
    });

  const gasto =
    plan.items.find(
      (item) =>
        item.origenTipo ===
        "GASTO"
    );

  const confirmacion =
    await crearSalidaCaja({
      origenTipo:
        "GASTO",
      origenId:
        gasto.origenId
    });

  await crearSalidaCaja({
    origenTipo:
      "GASTO",
    origenId:
      gasto.origenId,
    movimientoOriginalId:
      confirmacion._id,
    tipoAsiento:
      "REVERSION"
  });

  await assert.rejects(
    () =>
      confirmarItemPagado({
        empresaId:
          EMPRESA_ID,
        planId:
          plan._id,
        itemId:
          gasto._id,
        confirmadoBy:
          USUARIO_ID
      }),
    (error) =>
      error.statusCode === 409 &&
      /revertida/i.test(
        error.message
      )
  );
});

test("obligacion recurrente no puede confirmarse sin documento de pago real", async () => {
  const decision =
    decisionBase();

  const plan =
    await crearPlanDesdeDecision({
      decision,
      orden:
        decision
          .ordenes_por_departamento[0],
      createdBy:
        new mongoose.Types.ObjectId(
          USUARIO_ID
        )
    });

  const recurrente =
    plan.items.find(
      (item) =>
        item.origenTipo ===
        "RECURRENTE"
    );

  assert.equal(
    recurrente.estado,
    "REQUIERE_REGISTRO_PAGO"
  );

  await assert.rejects(
    () =>
      confirmarItemPagado({
        empresaId:
          EMPRESA_ID,
        planId:
          plan._id,
        itemId:
          recurrente._id,
        confirmadoBy:
          USUARIO_ID
      }),
    (error) =>
      error.statusCode === 409 &&
      /requiere primero/i.test(
        error.message
      )
  );
});

test("plan queda COMPLETADO cuando todos sus items confirmables estan confirmados", async () => {
  const origenId =
    new mongoose.Types.ObjectId();

  const plan =
    await PlanEjecucionPago.create({
      empresaId:
        EMPRESA_ID,
      sedeId: null,
      decisionId:
        new mongoose.Types.ObjectId(),
      ordenId:
        new mongoose.Types.ObjectId(),
      estado:
        "PENDIENTE_CONFIRMACION",
      saldoDisponibleSnapshot:
        200000,
      totalAutorizado:
        100000,
      items: [
        {
          origenTipo:
            "GASTO",
          origenId,
          descripcion:
            "Pago unico",
          monto:
            100000,
          estado:
            "PENDIENTE_CONFIRMACION"
        }
      ],
      createdBy:
        USUARIO_ID,
      deletedAt:
        null
    });

  await crearSalidaCaja({
    origenTipo:
      "GASTO",
    origenId
  });

  const confirmado =
    await confirmarItemPagado({
      empresaId:
        EMPRESA_ID,
      planId:
        plan._id,
      itemId:
        plan.items[0]._id,
      confirmadoBy:
        USUARIO_ID
    });

  assert.equal(
    confirmado.estado,
    "COMPLETADO"
  );

  assert.ok(
    confirmado.completedAt
  );
});
