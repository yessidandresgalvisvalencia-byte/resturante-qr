"use strict";

// P0-06 Mongo collection adapter. Explicit schema contract: no guessing from
// legacy sales/cash/stock documents. Caller supplies dedicated normalized
// collections with the exact fields consumed by the reconciliation primitives.
const ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
function validId(value) {
  if (typeof value !== "string" || !ID.test(value)) throw new Error("P006_MONGO_SCOPE_INVALIDO");
  return value;
}
function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("P006_MONGO_INVALIDO");
  const d = Object.getOwnPropertyDescriptor(value, key);
  if (!d || !Object.prototype.hasOwnProperty.call(d, "value")) throw new Error("P006_MONGO_CAMPO_INVALIDO_" + key);
  return d.value;
}
function collection(value) {
  if (!value || typeof value !== "object") throw new Error("P006_MONGO_COLECCION_INVALIDA");
  const d = Object.getOwnPropertyDescriptor(value, "find");
  if (!d || typeof d.value !== "function") throw new Error("P006_MONGO_COLECCION_INVALIDA");
  return d.value;
}
function makeMongoScopedReconciliationRepository(config) {
  const movementsCollection = own(config, "movementsCollection");
  const stockCollection = own(config, "stockCollection");
  const expectedCentavos = own(config, "expectedCentavos");
  // The expected amount is explicitly supplied by an independently verified
  // source; never silently derive the expected value from the same movements.
  if (typeof expectedCentavos !== "string" || !/^-?(0|[1-9][0-9]{0,15})$/.test(expectedCentavos) || expectedCentavos === "-0") {
    throw new Error("P006_MONGO_EXPECTED_INVALIDO");
  }
  const findMovements = collection(movementsCollection);
  const findStock = collection(stockCollection);
  async function readCollection(target, find, scope, projection, limit) {
    const cursor = find.call(target, Object.freeze({ ...scope }), { projection });
    if (!cursor || typeof cursor.limit !== "function") throw new Error("P006_MONGO_CURSOR_INVALIDO");
    const limited = cursor.limit(limit + 1);
    if (!limited || typeof limited.toArray !== "function") throw new Error("P006_MONGO_CURSOR_INVALIDO");
    const records = await limited.toArray();
    if (!Array.isArray(records) || records.length > limit) throw new Error("P006_MONGO_LIMITE");
    return records;
  }
  return Object.freeze({
    async readScopedSnapshot(request) {
      const empresaId = validId(own(request, "empresaId"));
      const sedeId = validId(own(request, "sedeId"));
      const scope = { empresaId, sedeId };
      const movements = await readCollection(movementsCollection, findMovements, scope,
        { _id: 0, empresaId: 1, sedeId: 1, idempotencyKey: 1, centavos: 1 }, 10000);
      const records = await readCollection(stockCollection, findStock, scope,
        { _id: 0, empresaId: 1, sedeId: 1, productoId: 1, unidad: 1, registrado: 1, fisico: 1 }, 10000);
      return { empresaId, sedeId, movements, records, expectedCentavos };
    }
  });
}
module.exports = { makeMongoScopedReconciliationRepository };
