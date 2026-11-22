"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readScopedReconciliation } = require("../../core/finanzas/lecturaConciliacionAcotada");

const scope = { empresaId: "empresa_A", sedeId: "sede_1" };
const snapshot = () => ({
  ...scope,
  expectedCentavos: "101",
  movements: [{ ...scope, idempotencyKey: "venta_1", centavos: "100" }],
  records: [{ ...scope, productoId: "sku_1", unidad: "unidad", registrado: "3", fisico: "2" }]
});
const repository = (readScopedSnapshot) => ({ readScopedSnapshot });

test("P0-06: el lector acotado devuelve diferencias exactas de caja e inventario", async () => {
  let calls = 0;
  const result = await readScopedReconciliation({
    ...scope, repository: repository(async (filter) => {
      calls++;
      assert.deepEqual(filter, scope);
      return snapshot();
    })
  });
  assert.equal(calls, 1);
  assert.equal(result.financial.differenceCentavos, "1");
  assert.equal(result.stock.diferencias[0].diferencia, "-1");
  assert.equal(result.financial.balanced, false);
  assert.equal(result.stock.balanced, false);
});

test("P0-06: nunca acepta un snapshot de otra empresa o sede", async () => {
  for (const patch of [{ empresaId: "empresa_B" }, { sedeId: "sede_2" }]) {
    await assert.rejects(readScopedReconciliation({
      ...scope, repository: repository(async () => ({ ...snapshot(), ...patch }))
    }), /P006_SCOPE_MISMATCH/);
  }
});

test("P0-06: no admite movimientos ni inventario cruzados aunque el encabezado coincida", async () => {
  for (const field of ["movements", "records"]) {
    const data = snapshot();
    data[field] = data[field].map((entry) => ({ ...entry, empresaId: "empresa_B" }));
    await assert.rejects(readScopedReconciliation({
      ...scope, repository: repository(async () => data)
    }), /TENANT_INCORRECTO/);
  }
});

test("P0-06: no ejecuta métodos heredados ni getters del repositorio", async () => {
  let called = false;
  const inherited = Object.create({ readScopedSnapshot() { called = true; return snapshot(); } });
  await assert.rejects(readScopedReconciliation({ ...scope, repository: inherited }), /P006_REPOSITORY_INVALIDO/);
  const accessor = Object.defineProperty({}, "readScopedSnapshot", {
    get() { called = true; throw Error("getter ejecutado"); }
  });
  await assert.rejects(readScopedReconciliation({ ...scope, repository: accessor }), /P006_REPOSITORY_INVALIDO/);
  assert.equal(called, false);
});

test("P0-06: no ejecuta getters de identidad o snapshot", async () => {
  let called = false;
  const request = Object.defineProperty({ sedeId: scope.sedeId, repository: repository(async () => snapshot()) }, "empresaId", {
    get() { called = true; throw Error("getter ejecutado"); }
  });
  await assert.rejects(readScopedReconciliation(request), /P006_RESPONSE_INVALIDA_empresaId/);
  const bad = Object.defineProperty(snapshot(), "movements", {
    get() { called = true; throw Error("getter ejecutado"); }
  });
  await assert.rejects(readScopedReconciliation({
    ...scope, repository: repository(async () => bad)
  }), /P006_RESPONSE_INVALIDA_movements/);
  assert.equal(called, false);
});

test("P0-06: un fallo de lectura se propaga sin sustituir datos ni realizar otra consulta", async () => {
  let calls = 0;
  await assert.rejects(readScopedReconciliation({
    ...scope, repository: repository(async () => { calls++; throw Error("mongo temporalmente no disponible"); })
  }), /mongo temporalmente no disponible/);
  assert.equal(calls, 1);
});
