// GRUK P0-04: safe aggregate-only diagnostic for legacy sales without sedeId.
// No writes, IDs, raw documents, company names, connection strings or index details.
'use strict';
const database = process.env.GRUK_ENTERPRISE_DB;
if (database !== 'restaurante' || process.env.GRUK_ENTERPRISE_DB_CONFIRM !== database) {
  throw new Error('Enterprise database confirmation required');
}
const databaseRef = db.getSiblingDB(database);
const sales = databaseRef.getCollection('ventas');
const saleCount = sales.estimatedDocumentCount();
if (!Number.isSafeInteger(saleCount) || saleCount < 1) {
  printjson({ saleCount: 0, requiresManualReview: true, safeToMigrate: false });
  throw new Error('Enterprise sales are empty or unreadable');
}
// Classify only legacy rows. Never select or print identifiable documents.
const result = sales.aggregate([
  { $match: { sedeId: { $not: { $type: 'objectId' } } } },
  { $lookup: {
    from: 'sedes',
    let: { enterprise: '$empresaId' },
    pipeline: [
      { $match: { $expr: { $eq: ['$empresaId', '$$enterprise'] } } },
      { $project: { _id: 1 } }
    ],
    as: 'candidateSites'
  } },
  { $project: {
    sedeType: { $type: '$sedeId' },
    candidates: { $size: '$candidateSites' }
  } },
  { $group: {
    _id: null,
    missing: { $sum: { $cond: [{ $eq: ['$sedeType', 'missing'] }, 1, 0] } },
    nullValues: { $sum: { $cond: [{ $eq: ['$sedeType', 'null'] }, 1, 0] } },
    otherTypes: { $sum: { $cond: [{ $not: { $in: ['$sedeType', ['missing', 'null']] } }, 1, 0] } },
    noCandidate: { $sum: { $cond: [{ $eq: ['$candidates', 0] }, 1, 0] } },
    oneCandidate: { $sum: { $cond: [{ $eq: ['$candidates', 1] }, 1, 0] } },
    multipleCandidates: { $sum: { $cond: [{ $gt: ['$candidates', 1] }, 1, 0] } },
    affectedSales: { $sum: 1 }
  } }
], { maxTimeMS: 15000 }).toArray();
const x = result[0] || {};
const fields = ['missing','nullValues','otherTypes','noCandidate','oneCandidate','multipleCandidates','affectedSales'];
const output = { saleCount };
for (const field of fields) {
  const value = x[field] || 0;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid aggregate count');
  output[field] = value;
}
if (output.missing + output.nullValues + output.otherTypes !== output.affectedSales ||
    output.noCandidate + output.oneCandidate + output.multipleCandidates !== output.affectedSales) {
  throw new Error('Inconsistent diagnostic aggregates');
}
// A single currently active site does not prove which site a historical sale used.
output.requiresManualReview = output.affectedSales > 0;
output.safeToMigrate = false;
printjson(output);
