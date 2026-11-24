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
  // The native MongoDB Collection.find method is inherited. Resolve data
  // descriptors without invoking getters, including shadowing accessors.
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("P006_MONGO_COLECCION_INVALIDA");
  let target = value;
  while (target && target !== Object.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(target, "find");
    if (descriptor) {
      if (!Object.prototype.hasOwnProperty.call(descriptor, "value") || typeof descriptor.value !== "function") {
        throw new Error("P006_MONGO_COLECCION_INVALIDA");
      }
      return descriptor.value;
    }
    target = Object.getPrototypeOf(target);
  }
  throw new Error("P006_MONGO_COLECCION_INVALIDA");
}
// Mongo cursors expose methods on their prototypes. Resolve data descriptors
// without executing attacker-controlled accessor properties.
function cursorMethod(cursor, key) {
  if (!cursor || (typeof cursor !== "object" && typeof cursor !== "function")) throw new Error("P006_MONGO_CURSOR_INVALIDO");
  let target = cursor;
  while (target && target !== Object.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor) {
      if (!Object.prototype.hasOwnProperty.call(descriptor, "value") || typeof descriptor.value !== "function") {
        throw new Error("P006_MONGO_CURSOR_INVALIDO");
      }
      return descriptor.value;
    }
    target = Object.getPrototypeOf(target);
  }
  throw new Error("P006_MONGO_CURSOR_INVALIDO");
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
    const limitCursor = cursorMethod(cursor, "limit");
    const limited = limitCursor.call(cursor, limit + 1);
    const toArray = cursorMethod(limited, "toArray");
    const records = await toArray.call(limited);
    if (!Array.isArray(records) || records.length > limit) throw new Error("P006_MONGO_LIMITE");
    // Reject cross-tenant records even if a driver, mock or collection ignores the filter.
    for (let index = 0; index < records.length; index++) {
      // A driver boundary must never execute inherited or accessor array entries.
      const descriptor = Object.getOwnPropertyDescriptor(records, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        throw new Error("P006_MONGO_REGISTRO_INVALIDO");
      }
      const record = descriptor.value;
      if (own(record, "empresaId") !== scope.empresaId || own(record, "sedeId") !== scope.sedeId) {
        throw new Error("P006_MONGO_SCOPE_MISMATCH");
      }
    }
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
