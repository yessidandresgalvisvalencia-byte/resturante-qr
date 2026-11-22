"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeMongoScopedReconciliationRepository } = require("../../core/finanzas/repositorioConciliacionMongoAcotado");
const { readScopedReconciliation } = require("../../core/finanzas/lecturaConciliacionAcotada");

function fakeCollection(rows, calls) {
  return {
    find(filter, options) {
      calls.push({ filter, options });
      return {
        limit(n) {
          calls[calls.length - 1].limit = n;
          return { async toArray() { return rows.slice(0, n); } };
        }
      };
    }
  };
}
test("Mongo adapter reads both collections with tenant filters and explicit projections", async () => {
  const calls = [];
  const repository = makeMongoScopedReconciliationRepository({
    movementsCollection: fakeCollection([{ empresaId: "e1", sedeId: "s1", idempotencyKey: "k1", centavos: "101" }], calls),
    stockCollection: fakeCollection([{ empresaId: "e1", sedeId: "s1", productoId: "p1", unidad: "g", registrado: "5", fisico: "4" }], calls),
    expectedCentavos: "101"
  });
  const result = await readScopedReconciliation({ empresaId: "e1", sedeId: "s1", repository });
  assert.equal(result.financial.balanced, true);
  assert.equal(result.stock.diferencias[0].diferencia, "-1");
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.deepEqual(call.filter, { empresaId: "e1", sedeId: "s1" });
    assert.equal(call.limit, 10001);
    assert.equal(call.options.projection._id, 0);
  }
});
test("Mongo adapter rejects cross-tenant data rather than silently filtering in JS", async () => {
  const calls = [];
  const repository = makeMongoScopedReconciliationRepository({
    movementsCollection: fakeCollection([{ empresaId: "other", sedeId: "s1", idempotencyKey: "k1", centavos: "1" }], calls),
    stockCollection: fakeCollection([], calls), expectedCentavos: "1"
  });
  await assert.rejects(readScopedReconciliation({ empresaId: "e1", sedeId: "s1", repository }), /TENANT_INCORRECTO/);
});
test("Mongo adapter rejects over-limit collection result", async () => {
  const cursor = { limit() { return { async toArray() { return Array(10001).fill(null); } }; } };
  const collection = { find() { return cursor; } };
  const repository = makeMongoScopedReconciliationRepository({
    movementsCollection: collection, stockCollection: collection, expectedCentavos: "0"
  });
  await assert.rejects(repository.readScopedSnapshot({ empresaId: "e1", sedeId: "s1" }), /P006_MONGO_LIMITE/);
});
test("Mongo adapter fails closed on missing expected independent balance", () => {
  assert.throws(() => makeMongoScopedReconciliationRepository({
    movementsCollection: { find() {} }, stockCollection: { find() {} }, expectedCentavos: 0
  }), /P006_MONGO_EXPECTED_INVALIDO/);
});
