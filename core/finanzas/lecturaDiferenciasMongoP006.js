"use strict";

// P0-06 read-only composition: explicitly supplied scoped Mongo collections ->
// deterministic reconciliation -> immutable discrepancy projection.
// No HTTP route, permission grant, persistence mutation, or production schema discovery.
const { reconcileFromMongoCollections } = require("./conciliacionMongoIntegradaP006");
const { projectReconciliationDifferences } = require("./proyeccionDiferenciasP006");

async function readMongoDiscrepancyProjection(request) {
  const result = await reconcileFromMongoCollections(request);
  return projectReconciliationDifferences(result);
}

module.exports = { readMongoDiscrepancyProjection };
