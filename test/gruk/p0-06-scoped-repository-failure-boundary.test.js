"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readScopedReconciliation } = require("../../core/finanzas/lecturaConciliacionAcotada");

const scoped = (empresaId = "empresa-a", sedeId = "sede-1") => ({
  empresaId, sedeId, expectedCentavos: "100",
  movements: [{ empresaId, sedeId, idempotencyKey: "venta-1", centavos: "90" }],
  records: [{ empresaId, sedeId, productoId: "p1", unidad: "unidad", registrado: "4", fisico: "3" }]
});

test("P0-06 scoped repository passes exact scope and returns both discrepancies", async () => {
  let calls = 0;
  const repository = { async readScopedSnapshot(scope) {
    calls++;
    assert.deepEqual(scope, { empresaId: "empresa-a", sedeId: "sede-1" });
    return scoped();
  }};
  const result = await readScopedReconciliation({ empresaId: "empresa-a", sedeId: "sede-1", repository });
  assert.equal(calls, 1);
  assert.equal(result.financial.differenceCentavos, "10");
  assert.equal(result.stock.diferencias[0].diferencia, "-1");
  assert.equal(Object.isFrozen(result), true);
});

test("P0-06 rejects cross-tenant repository snapshot", async () => {
  const repository = { async readScopedSnapshot() { return scoped("empresa-b"); } };
  await assert.rejects(readScopedReconciliation({ empresaId: "empresa-a", sedeId: "sede-1", repository }), /P006_SCOPE_MISMATCH/);
});

test("P0-06 rejects cross-site financial row despite scoped envelope", async () => {
  const repository = { async readScopedSnapshot() {
    const snapshot = scoped();
    snapshot.movements[0].sedeId = "sede-2";
    return snapshot;
  }};
  await assert.rejects(readScopedReconciliation({ empresaId: "empresa-a", sedeId: "sede-1", repository }), /CONCILIACION_TENANT_INCORRECTO/);
});

test("P0-06 rejects cross-tenant stock row despite scoped envelope", async () => {
  const repository = { async readScopedSnapshot() {
    const snapshot = scoped();
    snapshot.records[0].empresaId = "empresa-b";
    return snapshot;
  }};
  await assert.rejects(readScopedReconciliation({ empresaId: "empresa-a", sedeId: "sede-1", repository }), /STOCK_TENANT_INCORRECTO/);
});

test("P0-06 fails closed on repository failure", async () => {
  const repository = { async readScopedSnapshot() { throw new Error("DB_UNAVAILABLE"); } };
  await assert.rejects(readScopedReconciliation({ empresaId: "empresa-a", sedeId: "sede-1", repository }), /DB_UNAVAILABLE/);
});

test("P0-06 never invokes inherited or accessor repository readers", async () => {
  const inherited = Object.create({ readScopedSnapshot() { throw new Error("SHOULD_NOT_RUN"); } });
  await assert.rejects(readScopedReconciliation({ empresaId: "empresa-a", sedeId: "sede-1", repository: inherited }), /P006_REPOSITORY_INVALIDO/);
  const accessor = {};
  Object.defineProperty(accessor, "readScopedSnapshot", { get() { throw new Error("GETTER_EXECUTED"); } });
  await assert.rejects(readScopedReconciliation({ empresaId: "empresa-a", sedeId: "sede-1", repository: accessor }), /P006_REPOSITORY_INVALIDO/);
});
