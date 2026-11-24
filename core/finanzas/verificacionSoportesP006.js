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
function ownArrayRecord(records, index) {
  const descriptor = Object.getOwnPropertyDescriptor(records, String(index));
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
    throw new Error("P006_SOPORTE_INDICE_INVALIDO");
  }
  return descriptor.value;
}
function verifyMovementEvidence(request) {
  // Reject inherited/accessor request fields before any reads or collection traversal.
  const empresaId = field(request, "empresaId");
  const sedeId = field(request, "sedeId");
  const movements = field(request, "movements");
  const evidence = field(request, "evidence");
  id(empresaId); id(sedeId);
  if (!Array.isArray(movements) || !Array.isArray(evidence) || movements.length > 10000 || evidence.length > 10000) {
    throw new Error("P006_SOPORTE_LIMITE");
  }
  const keys = new Set();
  for (let index = 0; index < evidence.length; index++) {
    const record = ownArrayRecord(evidence, index);
    if (field(record, "empresaId") !== empresaId || field(record, "sedeId") !== sedeId) throw new Error("P006_SOPORTE_TENANT");
    const key = id(field(record, "soporteId"));
    if (keys.has(key)) throw new Error("P006_SOPORTE_DUPLICADO");
    keys.add(key);
  }
  const missing = new Set();
  const referencedEvidence = new Set();
  const movementKeys = new Set();
  for (let index = 0; index < movements.length; index++) {
    const movement = ownArrayRecord(movements, index);
    if (field(movement, "empresaId") !== empresaId || field(movement, "sedeId") !== sedeId) throw new Error("P006_MOVIMIENTO_TENANT");
    const movementKey = id(field(movement, "idempotencyKey"));
    if (movementKeys.has(movementKey)) throw new Error("P006_MOVIMIENTO_DUPLICADO");
    movementKeys.add(movementKey);
    const soporteId = field(movement, "soporteId");
    if (soporteId !== null) id(soporteId);
    if (soporteId === null || !keys.has(soporteId)) missing.add(movementKey);
    else referencedEvidence.add(soporteId);
  }
  const orphanEvidenceIds = Object.freeze([...keys].filter(key => !referencedEvidence.has(key)).sort());
  return Object.freeze({ empresaId, sedeId, unsupportedMovementKeys: Object.freeze([...missing].sort()), unsupportedCount: missing.size, orphanEvidenceIds, orphanEvidenceCount: orphanEvidenceIds.length });
}
module.exports = { verifyMovementEvidence };
