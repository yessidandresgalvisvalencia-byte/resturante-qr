"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeMongoScopedReconciliationRepository } = require("../../core/finanzas/repositorioConciliacionMongoAcotado");

const scope = { empresaId: "empresa1", sedeId: "sede1" };
function stockCollection() {
  return { find() { return { limit() { return { toArray: async () => [] }; } }; } };
}
function repositoryWith(cursor) {
  return makeMongoScopedReconciliationRepository({
    movementsCollection: { find() { return cursor; } },
    stockCollection: stockCollection(),
    expectedCentavos: "0"
  });
}
test("P0-06 rejects accessor limit without executing getter", async () => {
  let executed = false;
  const cursor = {};
  Object.defineProperty(cursor, "limit", { get() { executed = true; throw Error("getter executed"); } });
  await assert.rejects(repositoryWith(cursor).readScopedSnapshot(scope), /P006_MONGO_CURSOR_INVALIDO/);
  assert.equal(executed, false);
});
test("P0-06 rejects accessor toArray without executing getter", async () => {
  let executed = false;
  const limited = {};
  Object.defineProperty(limited, "toArray", { get() { executed = true; throw Error("getter executed"); } });
  const cursor = { limit() { return limited; } };
  await assert.rejects(repositoryWith(cursor).readScopedSnapshot(scope), /P006_MONGO_CURSOR_INVALIDO/);
  assert.equal(executed, false);
});
test("P0-06 accepts prototype-defined cursor methods", async () => {
  class Limited { async toArray() { return []; } }
  class Cursor { limit() { return new Limited(); } }
  const snapshot = await repositoryWith(new Cursor()).readScopedSnapshot(scope);
  assert.deepEqual(snapshot.movements, []);
  assert.deepEqual(snapshot.records, []);
});
