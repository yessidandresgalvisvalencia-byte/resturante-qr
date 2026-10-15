"use strict";

/**
 * Read-only preflight for a possible tenant-scoped Venta idempotency index.
 * Usage: MONGO_URI=... node scripts/audit-venta-idempotency.js
 * Does not create, drop, or modify indexes/documents.
 */
const mongoose = require("mongoose");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI_REQUIRED");
  await mongoose.connect(process.env.MONGO_URI, process.env.MONGO_DB ? { dbName: process.env.MONGO_DB } : {});
  try {
    const collection = mongoose.connection.db.collection("ventas");
    const indexes = await collection.indexes();
    const duplicateKeys = await collection.aggregate([
      { $match: { origenId: { $type: "objectId" } } },
      { $group: {
        _id: { empresaId: "$empresaId", origen: "$origen", origenId: "$origenId" },
        count: { $sum: 1 }
      } },
      { $match: { count: { $gt: 1 } } },
      { $count: "groups" }
    ], { allowDiskUse: true, maxTimeMS: 60000 }).toArray();
    const missingTenant = await collection.countDocuments({
      origenId: { $type: "objectId" },
      $or: [{ empresaId: { $exists: false } }, { empresaId: null }]
    }, { maxTimeMS: 60000 });
    const report = {
      collection: collection.collectionName,
      candidateKey: ["empresaId", "origen", "origenId"],
      duplicateCandidateKeyGroups: duplicateKeys[0]?.groups || 0,
      recordsMissingEmpresaId: missingTenant,
      indexes: indexes.map(({ name, key, unique, partialFilterExpression }) =>
        ({ name, key, unique: Boolean(unique), partialFilterExpression: partialFilterExpression || null })),
      safeToMigrate: false,
      note: "Audit only. Index migration requires review of historical data, backup, and controlled rollout."
    };
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (report.duplicateCandidateKeyGroups || report.recordsMissingEmpresaId) process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
}
if (require.main === module) main().catch(err => {
  console.error("VENTA_IDEMPOTENCY_AUDIT_FAILED:", err.message);
  process.exitCode = 1;
});
module.exports = { main };
