"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyEvidenceFromMongoCollections } = require("../../core/finanzas/verificacionSoportesMongoP006");

function collection(rows) {
  class Cursor {
    constructor() { this.rows = rows; }
    limit(n) { assert.equal(n, 10001); return this; }
    async toArray() { return this.rows; }
  }
  return {
    find(filter, options) {
      assert.deepEqual(filter, { empresaId: "empresa1", sedeId: "sede1" });
      assert.equal(options.maxTimeMS, 5000);
      return new Cursor();
    }
  };
}
const scope = { empresaId: "empresa1", sedeId: "sede1" };
test("P0-06 evidence reader accepts actual Mongo-style prototype cursor methods", async () => {
  const result = await verifyEvidenceFromMongoCollections({
    ...scope,
    movementsCollection: collection([]),
    evidenceCollection: collection([])
  });
  assert.ok(result && typeof result === "object");
});
test("P0-06 evidence reader rejects prototype accessor without executing it", async () => {
  let executed = false;
  class Cursor {
    get limit() { executed = true; throw new Error("accessor executed"); }
  }
  const malicious = { find() { return new Cursor(); } };
  await assert.rejects(
    verifyEvidenceFromMongoCollections({
      ...scope, movementsCollection: malicious, evidenceCollection: collection([])
    }),
    /P006_EVIDENCIA_CURSOR_INVALIDO/
  );
  assert.equal(executed, false);
});
test("P0-06 evidence reader rejects cross-tenant records from a nonconforming driver", async () => {
  await assert.rejects(
    verifyEvidenceFromMongoCollections({
      ...scope,
      movementsCollection: collection([{ ...scope, empresaId: "otra", idempotencyKey: "mov1", soporteId: "s1" }]),
      evidenceCollection: collection([])
    }),
    /P006_EVIDENCIA_TENANT/
  );
});
