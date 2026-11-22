"use strict";

// P0-06 read-only verification against explicitly normalized Mongo collections.
// No inferred legacy schema, write operations or automatic adjustments.
const { verifyMovementEvidence } = require("./verificacionSoportesP006");
const ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("P006_EVIDENCIA_REQUEST_INVALIDO");
  const d = Object.getOwnPropertyDescriptor(value, key);
  if (!d || !Object.prototype.hasOwnProperty.call(d, "value")) throw new Error("P006_EVIDENCIA_CAMPO_" + key);
  return d.value;
}
function validScope(value) {
  if (typeof value !== "string" || !ID.test(value)) throw new Error("P006_EVIDENCIA_SCOPE_INVALIDO");
  return value;
}
// MongoDB driver cursor methods normally live on prototypes. Walk data
// descriptors only: never invoke an accessor while resolving a method.
function cursorMethod(cursor, key) {
  if (!cursor || (typeof cursor !== "object" && typeof cursor !== "function")) throw new Error("P006_EVIDENCIA_CURSOR_INVALIDO");
  let target = cursor;
  while (target && target !== Object.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor) {
      if (!Object.prototype.hasOwnProperty.call(descriptor, "value") || typeof descriptor.value !== "function") {
        throw new Error("P006_EVIDENCIA_CURSOR_INVALIDO");
      }
      return descriptor.value;
    }
    target = Object.getPrototypeOf(target);
  }
  throw new Error("P006_EVIDENCIA_CURSOR_INVALIDO");
}
async function readRows(collection, scope, projection) {
  const find = own(collection, "find");
  if (typeof find !== "function") throw new Error("P006_EVIDENCIA_COLECCION_INVALIDA");
  const cursor = find.call(collection, Object.freeze({ ...scope }), { projection, maxTimeMS: 5000 });
  const limit = cursorMethod(cursor, "limit");
  if (typeof limit !== "function") throw new Error("P006_EVIDENCIA_CURSOR_INVALIDO");
  const limited = limit.call(cursor, 10001);
  const toArray = cursorMethod(limited, "toArray");
  if (typeof toArray !== "function") throw new Error("P006_EVIDENCIA_CURSOR_INVALIDO");
  const rows = await toArray.call(limited);
  if (!Array.isArray(rows) || rows.length > 10000) throw new Error("P006_EVIDENCIA_LIMITE");
  // Validate the entire driver boundary before forwarding rows to the verifier.
  for (let i = 0; i < rows.length; i++) {
    const d = Object.getOwnPropertyDescriptor(rows, String(i));
    if (!d || !Object.prototype.hasOwnProperty.call(d, "value")) throw new Error("P006_EVIDENCIA_REGISTRO_INVALIDO");
    const record = d.value;
    if (own(record, "empresaId") !== scope.empresaId || own(record, "sedeId") !== scope.sedeId) {
      throw new Error("P006_EVIDENCIA_TENANT");
    }
  }
  return rows;
}
async function verifyEvidenceFromMongoCollections(request) {
  const empresaId = validScope(own(request, "empresaId"));
  const sedeId = validScope(own(request, "sedeId"));
  const movementsCollection = own(request, "movementsCollection");
  const evidenceCollection = own(request, "evidenceCollection");
  const scope = { empresaId, sedeId };
  const movements = await readRows(movementsCollection, scope,
    { _id: 0, empresaId: 1, sedeId: 1, idempotencyKey: 1, soporteId: 1 });
  const evidence = await readRows(evidenceCollection, scope,
    { _id: 0, empresaId: 1, sedeId: 1, soporteId: 1 });
  return verifyMovementEvidence({ empresaId, sedeId, movements, evidence });
}
module.exports = { verifyEvidenceFromMongoCollections };
