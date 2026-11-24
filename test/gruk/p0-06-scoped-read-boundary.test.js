"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readScopedReconciliation } = require("../../core/finanzas/lecturaConciliacionAcotada");

const scope = { empresaId: "empresaA", sedeId: "sedeA" };
const snapshot = () => ({
  ...scope, expectedCentavos: "100",
  movements: [{ ...scope, idempotencyKey: "pago1", centavos: "100" }],
  records: [{ ...scope, productoId: "p1", unidad: "und", registrado: "3", fisico: "2" }]
});
test("P0-06 scoped adapter returns exact finance and stock differences", async () => {
  let received;
  const result = await readScopedReconciliation({ ...scope, repository: {
    async readScopedSnapshot(request) { received = request; return snapshot(); }
  } });
  assert.deepEqual(received, scope);
  assert.equal(result.financial.differenceCentavos, "0");
  assert.equal(result.stock.diferencias[0].diferencia, "-1");
  assert.ok(Object.isFrozen(result));
});
test("P0-06 fails closed on mismatched snapshot tenant", async () => {
  await assert.rejects(readScopedReconciliation({ ...scope, repository: {
    async readScopedSnapshot() { return { ...snapshot(), empresaId: "empresaB" }; }
  } }), /P006_SCOPE_MISMATCH/);
});
test("P0-06 rejects mixed-tenant rows even in scoped snapshot", async () => {
  await assert.rejects(readScopedReconciliation({ ...scope, repository: {
    async readScopedSnapshot() {
      const data = snapshot();
      data.movements[0].empresaId = "empresaB";
      return data;
    }
  } }), /CONCILIACION_TENANT_INCORRECTO/);
});
test("P0-06 never falls back to unscoped repository reads", async () => {
  await assert.rejects(readScopedReconciliation({ ...scope, repository: {
    async readAll() { throw new Error("must not be called"); }
  } }), /P006_REPOSITORY_INVALIDO/);
});
test("P0-06 rejects accessor-backed snapshot fields", async () => {
  await assert.rejects(readScopedReconciliation({ ...scope, repository: {
    async readScopedSnapshot() {
      const data = snapshot();
      Object.defineProperty(data, "records", { get() { throw new Error("getter executed"); } });
      return data;
    }
  } }), /P006_RESPONSE_INVALIDA_records/);
});
