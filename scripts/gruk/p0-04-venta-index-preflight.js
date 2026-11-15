// GRUK Empresarial P0-04: read-only preflight. No schema or data writes.
// mongosh "$GRUK_ENTERPRISE_MONGO_URI" --quiet --file scripts/gruk/p0-04-venta-index-preflight.js
// Explicitly set GRUK_ENTERPRISE_DB to the enterprise database name.
'use strict';
const name = process.env.GRUK_ENTERPRISE_DB;
if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Explicit GRUK_ENTERPRISE_DB required');
// Defense in depth: never inspect Personal or Blushea databases with enterprise tooling.
if (/(^|[_-])(personal|finanzas_personales|blushea)([_-]|$)/i.test(name)) throw new Error('Non-enterprise database prohibited');
// Require a second explicit operator confirmation before accessing any database.
// A typo in GRUK_ENTERPRISE_DB must not silently select another database.
if (process.env.GRUK_ENTERPRISE_DB_CONFIRM !== name) throw new Error('GRUK_ENTERPRISE_DB_CONFIRM must exactly match GRUK_ENTERPRISE_DB');
const sales = db.getSiblingDB(name).getCollection('ventas');
const indexes = sales.getIndexes();
printjson({ database: name, collection: 'ventas', indexes });
// A global unique origin index can reject valid cross-tenant sales even when data is clean.
const legacyGlobalUniqueIndexes = indexes.filter(index => index.unique === true &&
  index.key && Math.abs(index.key.origen) === 1 && Math.abs(index.key.origenId) === 1 &&
  !Object.prototype.hasOwnProperty.call(index.key, 'empresaId')).map(index => index.name);
// Inspect every sale, including originless records, for invalid enterprise ownership.
// This is stricter than the partial unique origin index and blocks unsafe migration.
// Uniqueness is independent of compound key order; compare exact key sets.
const targetKeys = ['empresaId', 'origen', 'origenId'];
const hasTargetKeys = key => key && Object.keys(key).length === targetKeys.length &&
  targetKeys.every(field => key[field] === 1);
const hasTargetFilter = index => {
  const filter = index.partialFilterExpression;
  if (!filter || Object.keys(filter).length !== 1 || !Object.prototype.hasOwnProperty.call(filter, 'origenId')) return false;
  const predicate = filter.origenId;
  return predicate && typeof predicate === 'object' && !Array.isArray(predicate) &&
    Object.keys(predicate).length === 1 && predicate.$type === 'objectId';
};
// A scoped unique index without the ObjectId partial filter can reject
// multiple originless sales in the same tenant.
const incompatibleTenantUniqueIndexes = indexes.filter(index =>
  index.unique === true && index.key &&
  Object.prototype.hasOwnProperty.call(index.key, 'empresaId') &&
  index.key.origen === 1 && index.key.origenId === 1 &&
  (!hasTargetKeys(index.key) || !hasTargetFilter(index))
).map(index => index.name);
// A clean dataset alone does not prove the intended index has been created.
// Report this separately from data readiness; never authorize legacy removal here.
const targetIndexPresent = indexes.some(index => index.unique === true && index.key &&
  hasTargetKeys(index.key) && hasTargetFilter(index));
const missingTenant = sales.countDocuments({
  empresaId: { $not: { $type: 'objectId' } }
});
// Legacy non-ObjectId origins bypass the partial unique index and require remediation.
// Multi-site ownership is independently required: a valid enterprise does not
// imply that a sale belongs to a valid site. Read-only audit, never backfill.
// Validate referenced enterprises, not just the ObjectId type.
const orphanEnterprises = sales.aggregate([
  { $match: { empresaId: { $type: 'objectId' } } },
  { $lookup: { from: 'empresas', localField: 'empresaId', foreignField: '_id', as: 'matchedEnterprise' } },
  { $match: { $expr: { $ne: [{ $size: '$matchedEnterprise' }, 1] } } },
  { $count: 'sales' }
]).toArray();
const invalidEnterpriseOwnership = orphanEnterprises.length ? orphanEnterprises[0].sales : 0;
const invalidSiteIds = sales.countDocuments({ sedeId: { $not: { $type: 'objectId' } } });
const invalidOriginIds = sales.countDocuments({ origenId: { $exists: true, $nin: [null], $not: { $type: 'objectId' } } });
// Origin must be a nonempty string whenever an ObjectId origin is present.
const invalidOriginNames = sales.countDocuments({ origenId: { $type: 'objectId' }, $or: [
  { origen: { $not: { $type: 'string' } } },
  { origen: { $regex: '^\\s*
] });
// Resolve each sale's site against the Sede model collection (Mongoose: 'sedes').
// A syntactically valid ObjectId is not proof of enterprise/site ownership.
const siteMismatches = sales.aggregate([
  { $match: { empresaId: { $type: 'objectId' }, sedeId: { $type: 'objectId' } } },
  { $lookup: { from: 'sedes', localField: 'sedeId', foreignField: '_id', as: 'matchedSite' } },
  { $match: { $expr: { $ne: [
    { $size: { $filter: { input: '$matchedSite', as: 'site', cond: { $eq: ['$site.empresaId', '$empresaId'] } } } },
    1
  ] } } },
  { $count: 'sales' }
]).toArray();
const invalidSiteOwnership = siteMismatches.length ? siteMismatches[0].sales : 0;
const duplicates = sales.aggregate([
  { $match: { origenId: { $type: 'objectId' } } },
  { $group: { _id: { empresaId: '$empresaId', origen: '$origen', origenId: '$origenId' }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
  { $count: 'groups' }
]).toArray();
const duplicateGroups = duplicates.length ? duplicates[0].groups : 0;
// Data readiness is independent of the legacy index: the legacy index is expected
// to coexist during a staged migration. Keep the conservative migration gate below.
const dataReadyForIndexBuild = missingTenant === 0 && invalidEnterpriseOwnership === 0 && invalidSiteIds === 0 && invalidSiteOwnership === 0 && invalidOriginIds === 0 && invalidOriginNames === 0 && duplicateGroups === 0;
const readyForIndexBuild = dataReadyForIndexBuild && legacyGlobalUniqueIndexes.length === 0 && incompatibleTenantUniqueIndexes.length === 0;
printjson({ missingTenant, invalidEnterpriseOwnership, invalidSiteIds, invalidSiteOwnership, invalidOriginIds, invalidOriginNames, duplicateGroups, legacyGlobalUniqueIndexes, incompatibleTenantUniqueIndexes, targetIndexPresent, dataReadyForIndexBuild, readyForIndexBuild });
if (missingTenant || invalidEnterpriseOwnership || invalidSiteIds || invalidSiteOwnership || invalidOriginIds || invalidOriginNames || duplicateGroups || legacyGlobalUniqueIndexes.length || incompatibleTenantUniqueIndexes.length) throw new Error('Data anomalies block index migration');
// A passing result does not authorize migration, index removal or deployment.
 } }
] });
// Resolve each sale's site against the Sede model collection (Mongoose: 'sedes').
// A syntactically valid ObjectId is not proof of enterprise/site ownership.
const siteMismatches = sales.aggregate([
  { $match: { empresaId: { $type: 'objectId' }, sedeId: { $type: 'objectId' } } },
  { $lookup: { from: 'sedes', localField: 'sedeId', foreignField: '_id', as: 'matchedSite' } },
  { $match: { $expr: { $ne: [
    { $size: { $filter: { input: '$matchedSite', as: 'site', cond: { $eq: ['$site.empresaId', '$empresaId'] } } } },
    1
  ] } } },
  { $count: 'sales' }
]).toArray();
const invalidSiteOwnership = siteMismatches.length ? siteMismatches[0].sales : 0;
const duplicates = sales.aggregate([
  { $match: { origenId: { $type: 'objectId' } } },
  { $group: { _id: { empresaId: '$empresaId', origen: '$origen', origenId: '$origenId' }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
  { $count: 'groups' }
]).toArray();
const duplicateGroups = duplicates.length ? duplicates[0].groups : 0;
// Data readiness is independent of the legacy index: the legacy index is expected
// to coexist during a staged migration. Keep the conservative migration gate below.
const dataReadyForIndexBuild = missingTenant === 0 && invalidEnterpriseOwnership === 0 && invalidSiteIds === 0 && invalidSiteOwnership === 0 && invalidOriginIds === 0 && invalidOriginNames === 0 && duplicateGroups === 0;
const readyForIndexBuild = dataReadyForIndexBuild && legacyGlobalUniqueIndexes.length === 0 && incompatibleTenantUniqueIndexes.length === 0;
printjson({ missingTenant, invalidEnterpriseOwnership, invalidSiteIds, invalidSiteOwnership, invalidOriginIds, invalidOriginNames, duplicateGroups, legacyGlobalUniqueIndexes, incompatibleTenantUniqueIndexes, targetIndexPresent, dataReadyForIndexBuild, readyForIndexBuild });
if (missingTenant || invalidEnterpriseOwnership || invalidSiteIds || invalidSiteOwnership || invalidOriginIds || invalidOriginNames || duplicateGroups || legacyGlobalUniqueIndexes.length || incompatibleTenantUniqueIndexes.length) throw new Error('Data anomalies block index migration');
// A passing result does not authorize migration, index removal or deployment.
