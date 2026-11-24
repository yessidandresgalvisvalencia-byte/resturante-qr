"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyEvidenceFromMongoCollections } = require("../../core/finanzas/verificacionSoportesMongoP006");

const empresaId = "empresa-uno";
const sedeId = "sede-uno";
function collection(rows) {
  class Cursor {
    limit(n) { assert.equal(n, 10001); return this; }
    async toArray() { return rows; }
  }
  class Collection {
    find(filter, options) {
      assert.deepEqual(filter, { empresaId, sedeId });
      assert.equal(options.maxTimeMS, 5000);
      return new Cursor();
    }
  }
  return new Collection();
}

test("P0-06 accepts Mongo collection.find and cursor methods on prototypes", async () => {
  const result = await verifyEvidenceFromMongoCollections({
    empresaId, sedeId,
    movementsCollection: collection([]),
    evidenceCollection: collection([])
  });
  assert.ok(result && typeof result === "object");
});

test("P0-06 refuses accessor-backed collection.find without invoking it", async () => {
  let invoked = false;
  const malicious = {};
  Object.defineProperty(malicious, "find", { get() { invoked = true; throw Error("getter executed"); } });
  await assert.rejects(
    verifyEvidenceFromMongoCollections({
      empresaId, sedeId,
      movementsCollection: malicious,
      evidenceCollection: collection([])
    }),
    /P006_EVIDENCIA_CURSOR_INVALIDO/
  );
  assert.equal(invoked, false);
});
