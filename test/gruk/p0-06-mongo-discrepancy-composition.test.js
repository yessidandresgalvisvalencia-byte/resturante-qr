"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readMongoDiscrepancyProjection } = require("../../core/finanzas/lecturaDiferenciasMongoP006");

function collection(rows, filters) {
  return { find(filter) {
    filters.push(filter);
    return { limit(n) { return { async toArray() { return rows.slice(0, n); } }; } };
  } };
}
test("P0-06 Mongo differences composition returns exact scoped read-only projection", async () => {
  const filters = [];
  const result = await readMongoDiscrepancyProjection({
    empresaId: "empresa1", sedeId: "sede1",
    movementsCollection: collection([{ empresaId: "empresa1", sedeId: "sede1", idempotencyKey: "m1", centavos: "101" }], filters),
    stockCollection: collection([{ empresaId: "empresa1", sedeId: "sede1", productoId: "p1", unidad: "g", registrado: "8", fisico: "7" }], filters),
    expectedCentavos: "100"
  });
  assert.equal(result.empresaId, "empresa1");
  assert.equal(result.sedeId, "sede1");
  assert.equal(result.differenceCentavos, "-1");
  assert.equal(result.cashMismatch, true);
  assert.deepEqual(result.stockDifferences, [{ productoId: "p1", unidad: "g", diferencia: "-1" }]);
  assert.equal(result.readOnly, true);
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(filters, [
    { empresaId: "empresa1", sedeId: "sede1" },
    { empresaId: "empresa1", sedeId: "sede1" }
  ]);
});
test("P0-06 Mongo differences composition rejects foreign tenant records", async () => {
  await assert.rejects(readMongoDiscrepancyProjection({
    empresaId: "empresa1", sedeId: "sede1",
    movementsCollection: collection([{ empresaId: "foreign", sedeId: "sede1", idempotencyKey: "m1", centavos: "101" }], []),
    stockCollection: collection([], []), expectedCentavos: "100"
  }), /P006_MONGO_SCOPE_MISMATCH/);
});
