"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeMongoScopedReconciliationRepository } = require("../../core/finanzas/repositorioConciliacionMongoAcotado");

const empresaId = "empresa-uno";
const sedeId = "sede-uno";
function collection(rows) {
  class Cursor {
    limit(n) { assert.equal(n, 10001); return this; }
    async toArray() { return rows; }
  }
  class Collection {
    find(filter) {
      assert.deepEqual(filter, { empresaId, sedeId });
      return new Cursor();
    }
  }
  return new Collection();
}

test("P0-06 reconciliation repository reads native-style prototype collection methods", async () => {
  const repository = makeMongoScopedReconciliationRepository({
    movementsCollection: collection([]),
    stockCollection: collection([]),
    expectedCentavos: "0"
  });
  const snapshot = await repository.readScopedSnapshot({ empresaId, sedeId });
  assert.deepEqual(snapshot.movements, []);
  assert.deepEqual(snapshot.records, []);
  assert.equal(snapshot.expectedCentavos, "0");
});

test("P0-06 reconciliation rejects accessor find without executing getter", async () => {
  let invoked = false;
  const malicious = {};
  Object.defineProperty(malicious, "find", { get() { invoked = true; throw Error("getter executed"); } });
  assert.throws(() => makeMongoScopedReconciliationRepository({
    movementsCollection: malicious,
    stockCollection: collection([]),
    expectedCentavos: "0"
  }), /P006_MONGO_COLECCION_INVALIDA/);
  assert.equal(invoked, false);
});

test("P0-06 reconciliation rejects inherited find shadowed by accessor", async () => {
  let invoked = false;
  const malicious = Object.create(collection([]));
  Object.defineProperty(malicious, "find", { get() { invoked = true; throw Error("getter executed"); } });
  assert.throws(() => makeMongoScopedReconciliationRepository({
    movementsCollection: malicious,
    stockCollection: collection([]),
    expectedCentavos: "0"
  }), /P006_MONGO_COLECCION_INVALIDA/);
  assert.equal(invoked, false);
});
