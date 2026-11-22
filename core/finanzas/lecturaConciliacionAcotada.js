"use strict";

// P0-06 integration boundary. The injected repository must implement a
// tenant-scoped read; this module deliberately does not guess DB schemas.
const { reconcileMovements } = require("./reconciliacionExacta");
const { reconcileStock } = require("./conciliacionStockExacta");

const ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
function scopeId(value) {
  if (typeof value !== "string" || !ID.test(value)) throw new Error("P006_SCOPE_INVALIDO");
  return value;
}
function own(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("P006_RESPONSE_INVALIDA");
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) throw new Error("P006_RESPONSE_INVALIDA_" + field);
  return descriptor.value;
}
async function readScopedReconciliation({ empresaId, sedeId, repository }) {
  scopeId(empresaId);
  scopeId(sedeId);
  if (!repository || typeof repository.readScopedSnapshot !== "function") throw new Error("P006_REPOSITORY_INVALIDO");
  // No broad read, no fallback to unscoped queries.
  const snapshot = await repository.readScopedSnapshot({ empresaId, sedeId });
  if (own(snapshot, "empresaId") !== empresaId || own(snapshot, "sedeId") !== sedeId) throw new Error("P006_SCOPE_MISMATCH");
  const movements = own(snapshot, "movements");
  const expectedCentavos = own(snapshot, "expectedCentavos");
  const records = own(snapshot, "records");
  // Both pure validators independently enforce tenant scope and exact units.
  const financial = reconcileMovements({ empresaId, sedeId, movements, expectedCentavos });
  const stock = reconcileStock({ empresaId, sedeId, records });
  return Object.freeze({ empresaId, sedeId, financial, stock });
}
module.exports = { readScopedReconciliation };
