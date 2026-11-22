"use strict";

// P0-06: deterministic verification of persisted evidence references.
// This is a read-only primitive; callers must supply tenant-scoped records
// from independently validated collections. It does not authorize adjustments.
const ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
function field(obj, name) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("P006_SOPORTE_REGISTRO_INVALIDO");
  const d = Object.getOwnPropertyDescriptor(obj, name);
  if (!d || !Object.prototype.hasOwnProperty.call(d, "value")) throw new Error("P006_SOPORTE_CAMPO_INVALIDO_" + name);
  return d.value;
}
function id(value) {
  if (typeof value !== "string" || !ID.test(value)) throw new Error("P006_SOPORTE_ID_INVALIDO");
  return value;
}
function verifyMovementEvidence({ empresaId, sedeId, movements, evidence }) {
  id(empresaId); id(sedeId);
  if (!Array.isArray(movements) || !Array.isArray(evidence) || movements.length > 10000 || evidence.length > 10000) {
    throw new Error("P006_SOPORTE_LIMITE");
  }
  const keys = new Set();
  for (const record of evidence) {
    if (field(record, "empresaId") !== empresaId || field(record, "sedeId") !== sedeId) throw new Error("P006_SOPORTE_TENANT");
    const key = id(field(record, "soporteId"));
    if (keys.has(key)) throw new Error("P006_SOPORTE_DUPLICADO");
    keys.add(key);
  }
  const missing = new Set();
  const movementKeys = new Set();
  for (const movement of movements) {
    if (field(movement, "empresaId") !== empresaId || field(movement, "sedeId") !== sedeId) throw new Error("P006_MOVIMIENTO_TENANT");
    const movementKey = id(field(movement, "idempotencyKey"));
    if (movementKeys.has(movementKey)) throw new Error("P006_MOVIMIENTO_DUPLICADO");
    movementKeys.add(movementKey);
    const soporteId = field(movement, "soporteId");
    if (soporteId !== null) id(soporteId);
    if (soporteId === null || !keys.has(soporteId)) missing.add(movementKey);
  }
  return Object.freeze({ empresaId, sedeId, unsupportedMovementKeys: Object.freeze([...missing].sort()), unsupportedCount: missing.size });
}
module.exports = { verifyMovementEvidence };
