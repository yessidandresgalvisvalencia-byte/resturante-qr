// GRUK Empresarial P0-04: read-only preflight. No schema or data writes.
// mongosh "$GRUK_ENTERPRISE_MONGO_URI" --quiet --file scripts/gruk/p0-04-venta-index-preflight.js
// Explicitly set GRUK_ENTERPRISE_DB to the enterprise database name.
'use strict';
const name = process.env.GRUK_ENTERPRISE_DB;
if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Explicit GRUK_ENTERPRISE_DB required');
const sales = db.getSiblingDB(name).getCollection('ventas');
const indexes = sales.getIndexes();
printjson({ database: name, collection: 'ventas', indexes });
// A global unique origin index can reject valid cross-tenant sales even when data is clean.
const legacyGlobalUniqueIndexes = indexes.filter(index => index.unique === true &&
  index.key && index.key.origen === 1 && index.key.origenId === 1 &&
  !Object.prototype.hasOwnProperty.call(index.key, 'empresaId')).map(index => index.name);
// Inspect all sales: originless legacy records must not bypass tenant isolation.
// Only origin-indexed sales participate in this partial unique constraint.
const missingTenant = sales.countDocuments({
  origenId: { $type: 'objectId' },
  empresaId: { $not: { $type: 'objectId' } }
});
const duplicates = sales.aggregate([
  { $match: { origenId: { $type: 'objectId' } } },
  { $group: { _id: { empresaId: '$empresaId', origen: '$origen', origenId: '$origenId' }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
  { $count: 'groups' }
]).toArray();
const duplicateGroups = duplicates.length ? duplicates[0].groups : 0;
printjson({ missingTenant, duplicateGroups, legacyGlobalUniqueIndexes, readyForIndexBuild: missingTenant === 0 && duplicateGroups === 0 && legacyGlobalUniqueIndexes.length === 0 });
if (missingTenant || duplicateGroups || legacyGlobalUniqueIndexes.length) throw new Error('Data anomalies block index migration');
// A passing result does not authorize migration, index removal or deployment.
