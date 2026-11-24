"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyEvidenceFromMongoCollections } = require("../../core/finanzas/verificacionSoportesMongoP006");

function collection(rows, calls) {
  return { find(filter, options) {
    calls.push({ filter, options });
    return { limit(n) {
      assert.equal(n, 10001);
      return { async toArray() { return rows; } };
    } };
  } };
}
function request(movements, evidence, calls = []) {
  return {
    empresaId: "e1", sedeId: "s1",
    movementsCollection: collection(movements, calls),
    evidenceCollection: collection(evidence, calls)
  };
}
const movement = (key, soporteId, empresaId = "e1", sedeId = "s1") =>
  ({ empresaId, sedeId, idempotencyKey: key, soporteId });
const support = (soporteId, empresaId = "e1", sedeId = "s1") =>
  ({ empresaId, sedeId, soporteId });

test("P0-06 Mongo evidence: reports unsupported movements and scoped projections", async () => {
  const calls = [];
  const result = await verifyEvidenceFromMongoCollections(request(
    [movement("m1", "doc1"), movement("m2", "missing"), movement("m3", null)],
    [support("doc1")], calls));
  assert.deepEqual(result.unsupportedMovementKeys, ["m2", "m3"]);
  assert.equal(result.unsupportedCount, 2);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(c => c.options.maxTimeMS), [5000, 5000]);
  assert.deepEqual(calls.map(c => c.filter), [{ empresaId: "e1", sedeId: "s1" }, { empresaId: "e1", sedeId: "s1" }]);
  assert.deepEqual(calls[0].options.projection, { _id: 0, empresaId: 1, sedeId: 1, idempotencyKey: 1, soporteId: 1 });
  assert.deepEqual(calls[1].options.projection, { _id: 0, empresaId: 1, sedeId: 1, soporteId: 1 });
});
test("P0-06 Mongo evidence: rejects foreign movement before reading evidence", async () => {
  const calls = [];
  await assert.rejects(verifyEvidenceFromMongoCollections(request(
    [movement("m1", "doc1", "other")], [support("doc1")], calls)), /P006_EVIDENCIA_TENANT/);
  assert.equal(calls.length, 1);
});
test("P0-06 Mongo evidence: rejects foreign support and duplicate movement", async () => {
  await assert.rejects(verifyEvidenceFromMongoCollections(request(
    [movement("m1", "doc1")], [support("doc1", "other")])), /P006_EVIDENCIA_TENANT/);
  await assert.rejects(verifyEvidenceFromMongoCollections(request(
    [movement("m1", "doc1"), movement("m1", "doc2")], [support("doc1"), support("doc2")])), /P006_MOVIMIENTO_DUPLICADO/);
});
test("P0-06 Mongo evidence: rejects unbounded driver results", async () => {
  await assert.rejects(verifyEvidenceFromMongoCollections(request(
    Array.from({ length: 10001 }, (_, i) => movement("m" + i, null)), [])), /P006_EVIDENCIA_LIMITE/);
});
test("P0-06 Mongo evidence: rejects accessor array entries without evaluating getter", async () => {
  const rows = [movement("m1", null)];
  Object.defineProperty(rows, "0", { get() { throw new Error("getter executed"); }, configurable: true });
  await assert.rejects(verifyEvidenceFromMongoCollections(request(rows, [])), /P006_EVIDENCIA_REGISTRO_INVALIDO/);
});

test("P0-06 Mongo evidence: never invokes cursor method getters", async () => {
  for (const method of ["limit", "toArray"]) {
    let invoked = false;
    const malicious = {
      find() {
        const cursor = method === "limit"
          ? {}
          : { limit() { return {}; } };
        const target = method === "limit" ? cursor : cursor.limit();
        Object.defineProperty(target, method, {
          get() { invoked = true; throw new Error("unsafe cursor getter"); }
        });
        if (method === "toArray") cursor.limit = () => target;
        return cursor;
      }
    };
    const req = request([], []);
    req.movementsCollection = malicious;
    await assert.rejects(verifyEvidenceFromMongoCollections(req), /P006_EVIDENCIA_CURSOR_INVALIDO/);
    assert.equal(invoked, false);
  }
});
