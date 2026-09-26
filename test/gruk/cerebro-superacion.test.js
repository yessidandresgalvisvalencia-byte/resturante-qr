"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Decision = require(
  "../../intelligence/models/CerebroDecision"
);
const Auditoria = require(
  "../../intelligence/models/CerebroAuditoria"
);
const {
  superarOrdenesFinancierasPendientes,
  requiereActualizarDecisionFinanciera
} = require(
  "../../intelligence/brain/cerebro"
);

const EMPRESA_ID =
  "507f1f77bcf86cd799439601";

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
        "gruk_test_cerebro_superacion"
    }
  );
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Promise.all([
    Decision.deleteMany({}),
    Auditoria.deleteMany({})
  ]);
});

test("supera solo ordenes financieras pendientes y audita como sistema", async () => {
  const anterior =
    await Decision.create({
      empresaId:
        EMPRESA_ID,
      sedeId: null,
      decisionFingerprint:
        "a".repeat(64),
      decision_general: {
        situacion:
          "Riesgo de caja",
        causa_raiz:
          "Brecha 7d",
        prediccion:
          "Puede faltar caja"
      },
      contexto_financiero: {
        fuente:
          "TESORERIA_GRUK",
        estado7d:
          "DEPENDE_DE_COBROS",
        confiabilidad:
          "COMPLETO",
        saldoActual:
          100000,
        obligaciones7d:
          250000,
        cobros7d:
          200000,
        faltanteConCajaActual:
          150000,
        faltanteAunCobrandoTodo:
          0,
        fechaCritica:
          new Date()
      },
      ordenes_por_departamento: [
        {
          departamento:
            "FINANZAS",
          tarea:
            "Controlar brecha",
          prioridad:
            "ALTA",
          kpi_a_medir:
            "brecha_caja_7d",
          automatizable:
            false
        },
        {
          departamento:
            "OPERACIONES",
          tarea:
            "Revisar inventario",
          prioridad:
            "MEDIA",
          kpi_a_medir:
            "inventario_configurado",
          automatizable:
            false
        }
      ],
      confianza_global:
        90,
      riesgo_si_no_se_hace:
        "Riesgo",
      como_medir_exito_en_7_dias:
        "Recalcular"
    });

  const nueva =
    await Decision.create({
      empresaId:
        EMPRESA_ID,
      sedeId: null,
      decisionFingerprint:
        "b".repeat(64),
      decision_general: {
        situacion:
          "Cobertura restablecida",
        causa_raiz:
          "Nueva evidencia",
        prediccion:
          "Cobertura estable"
      },
      contexto_financiero: {
        fuente:
          "TESORERIA_GRUK",
        estado7d:
          "CUBIERTO_CON_CAJA_ACTUAL",
        confiabilidad:
          "COMPLETO",
        saldoActual:
          400000,
        obligaciones7d:
          250000,
        cobros7d:
          0,
        faltanteConCajaActual:
          0,
        faltanteAunCobrandoTodo:
          0,
        fechaCritica:
          new Date()
      },
      ordenes_por_departamento: [],
      confianza_global:
        90,
      riesgo_si_no_se_hace:
        "Sin riesgo inmediato",
      como_medir_exito_en_7_dias:
        "Mantener cobertura"
    });

  const cantidad =
    await superarOrdenesFinancierasPendientes({
      decision:
        anterior.toObject(),
      nuevaDecisionId:
        nueva._id
    });

  assert.equal(
    cantidad,
    1
  );

  const actualizada =
    await Decision.findById(
      anterior._id
    ).lean();

  const finanzas =
    actualizada
      .ordenes_por_departamento
      .find(
        (item) =>
          item.departamento ===
          "FINANZAS"
      );

  const operaciones =
    actualizada
      .ordenes_por_departamento
      .find(
        (item) =>
          item.departamento ===
          "OPERACIONES"
      );

  assert.equal(
    finanzas.estado,
    "SUPERADA"
  );

  assert.equal(
    String(
      finanzas.superadaPorDecisionId
    ),
    String(nueva._id)
  );

  assert.ok(
    finanzas.superadaAt
  );

  assert.equal(
    operaciones.estado,
    "PENDIENTE_APROBACION"
  );

  const auditoria =
    await Auditoria.findOne({
      decisionId:
        anterior._id,
      ordenId:
        finanzas._id,
      accion:
        "SUPERAR"
    }).lean();

  assert.ok(auditoria);
  assert.equal(
    auditoria.usuarioId,
    null
  );
  assert.equal(
    auditoria.metadata?.actor,
    "SISTEMA"
  );
});

test("agenda cubierta pide decision de cierre si la ultima decision seguia en riesgo", async () => {
  await Decision.create({
    empresaId:
      EMPRESA_ID,
    sedeId: null,
    decisionFingerprint:
      "c".repeat(64),
    decision_general: {
      situacion:
        "Riesgo de caja",
      causa_raiz:
        "Brecha",
      prediccion:
        "Riesgo"
    },
    contexto_financiero: {
      fuente:
        "TESORERIA_GRUK",
      estado7d:
        "DEFICIT_AUN_COBRANDO_TODO",
      confiabilidad:
        "COMPLETO",
      saldoActual:
        100000,
      obligaciones7d:
        500000,
      cobros7d:
        100000,
      faltanteConCajaActual:
        400000,
      faltanteAunCobrandoTodo:
        300000,
      fechaCritica:
        new Date()
    },
    ordenes_por_departamento: [],
    confianza_global:
      90,
    riesgo_si_no_se_hace:
      "Riesgo",
    como_medir_exito_en_7_dias:
      "Cerrar brecha"
  });

  const requiere =
    await requiereActualizarDecisionFinanciera(
      EMPRESA_ID,
      {
        estado7d:
          "CUBIERTO_CON_CAJA_ACTUAL",
        requiereDecision:
          false
      }
    );

  assert.equal(
    requiere,
    true
  );
});
