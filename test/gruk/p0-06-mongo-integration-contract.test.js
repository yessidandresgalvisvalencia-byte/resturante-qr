"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileFromMongoCollections } = require("../../core/finanzas/conciliacionMongoIntegradaP006");

function collection(rows, calls) {
  return { find(filter, options) {
    calls.push({ filter, options });
    return { limit(n) { return { async toArray() { return rows.slice(0, n); } }; } };
  } };
}
test("P0-06 integrated Mongo read produces exact cash and stock differences", async () => {
  const calls = [];
  const result = await reconcileFromMongoCollections({
    empresaId: "empresa1", sedeId: "sede1",
    movementsCollection: collection([{ empresaId: "empresa1", sedeId: "sede1", idempotencyKey: "sale1", centavos: "101" }], calls),
    stockCollection: collection([{ empresaId: "empresa1", sedeId: "sede1", productoId: "item1", unidad: "g", registrado: "8", fisico: "7" }], calls),
    expectedCentavos: "101"
  });
  assert.equal(result.financial.balanced, true);
  assert.equal(result.stock.diferencias[0].diferencia, "-1");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(c => c.filter), [
    { empresaId: "empresa1", sedeId: "sede1" },
    { empresaId: "empresa1", sedeId: "sede1" }
  ]);
});
test("P0-06 integrated Mongo read rejects foreign-tenant rows", async () => {
  const calls = [];
  await assert.rejects(reconcileFromMongoCollections({
    empresaId: "empresa1", sedeId: "sede1",
    movementsCollection: collection([{ empresaId: "empresa2", sedeId: "sede1", idempotencyKey: "sale1", centavos: "101" }], calls),
    stockCollection: collection([], calls), expectedCentavos: "101"
  }), /P006_MONGO_SCOPE_MISMATCH/);
  assert.equal(calls.length, 1);
});
test("P0-06 integration fails closed on absent independently verified balance", async () => {
  await assert.rejects(reconcileFromMongoCollections({
    empresaId: "empresa1", sedeId: "sede1",
    movementsCollection: collection([], []), stockCollection: collection([], []),
    expectedCentavos: null
  }), /P006_MONGO_EXPECTED_INVALIDO/);
});
