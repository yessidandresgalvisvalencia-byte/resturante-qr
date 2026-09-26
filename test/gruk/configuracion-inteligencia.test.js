"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Empresa = require("../../models/Empresa");

const {
  obtenerConfiguracionInteligencia,
  actualizarConfiguracionInteligencia
} = require(
  "../../core/empresa/configuracionInteligencia.service"
);

const USER =
  "507f1f77bcf86cd799439a03";

let empresa;

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
        "gruk_test_config_inteligencia"
    }
  );
});

test.after(async () => {
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Empresa.deleteMany({});

  empresa =
    await Empresa.create({
      empresaId:
        "emp_config_test",
      nombre:
        "Empresa Config Test",
      tipoNegocio:
        "restaurante",
      correo:
        "config@test.local",
      estado:
        "activa"
    });
});

test("empresa legacy inicia incompleta y puede quedar 5 de 5 sin inventar valores", async () => {
  const inicial =
    await obtenerConfiguracionInteligencia(
      empresa._id
    );

  assert.equal(
    inicial.completo,
    false
  );

  assert.equal(
    inicial.configurados,
    0
  );

  assert.equal(
    inicial.faltantes.length,
    5
  );

  const actualizada =
    await actualizarConfiguracionInteligencia({
      empresaId:
        empresa._id,
      valores: {
        margen_objetivo:
          35,
        punto_equilibrio:
          15000000,
        ticket_objetivo:
          35000,
        cac_maximo:
          12000,
        empleados_actuales:
          8
      },
      updatedBy:
        USER
    });

  assert.equal(
    actualizada.completo,
    true
  );

  assert.equal(
    actualizada.configurados,
    5
  );

  assert.equal(
    actualizada.porcentaje,
    100
  );

  assert.deepEqual(
    actualizada.valores,
    {
      margen_objetivo:
        35,
      punto_equilibrio:
        15000000,
      ticket_objetivo:
        35000,
      cac_maximo:
        12000,
      empleados_actuales:
        8
    }
  );

  assert.ok(
    actualizada.updatedAt
  );

  assert.equal(
    String(
      actualizada.updatedBy
    ),
    USER
  );
});
