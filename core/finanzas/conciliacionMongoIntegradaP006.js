"use strict";

// P0-06 explicit Mongo collection integration. No schema inference or global reads.
const { makeMongoScopedReconciliationRepository } = require("./repositorioConciliacionMongoAcotado");
const { readScopedReconciliation } = require("./lecturaConciliacionAcotada");

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("P006_INTEGRACION_INVALIDA");
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) throw new Error("P006_INTEGRACION_CAMPO_" + key);
  return descriptor.value;
}

// Requires normalized, tenant-scoped collections and an independently sourced
// expected cash balance. Does not claim to connect legacy production schemas.
async function reconcileFromMongoCollections(request) {
  const empresaId = own(request, "empresaId");
  const sedeId = own(request, "sedeId");
  const movementsCollection = own(request, "movementsCollection");
  const stockCollection = own(request, "stockCollection");
  const expectedCentavos = own(request, "expectedCentavos");
  const repository = makeMongoScopedReconciliationRepository({
    movementsCollection, stockCollection, expectedCentavos
  });
  return readScopedReconciliation({ empresaId, sedeId, repository });
}

module.exports = { reconcileFromMongoCollections };
