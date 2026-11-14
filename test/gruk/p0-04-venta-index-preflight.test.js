'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../scripts/gruk/p0-04-venta-index-preflight.js'), 'utf8');

function preflight({ name = 'gruk_enterprise_test', missingTenant = 0, invalidSiteIds = 0, duplicateGroups = 0, invalidOriginIds = 0, invalidOriginNames = 0, indexes = [{ name: '_id_' }] } = {}) {
  const calls = [];
  const collection = {
    getIndexes() { calls.push('getIndexes'); return indexes; },
    countDocuments(query) {
      const normalized = JSON.parse(JSON.stringify(query));
      const missingTenantQuery = { empresaId: { $not: { $type: 'objectId' } } };
      const invalidSiteQuery = { sedeId: { $not: { $type: 'objectId' } } };
      const invalidOriginQuery = { origenId: { $exists: true, $nin: [null], $not: { $type: 'objectId' } } };
      const invalidOriginNameQuery = { origenId: { $type: 'objectId' }, $or: [
        { origen: { $not: { $type: 'string' } } },
        { origen: { $regex: '^\\s*$' } }
      ] };
      const countNumber = calls.filter(call => call === 'countDocuments').length;
      assert.deepEqual(normalized, [missingTenantQuery, invalidSiteQuery, invalidOriginQuery, invalidOriginNameQuery][countNumber]);
      calls.push('countDocuments');
      return [missingTenant, invalidSiteIds, invalidOriginIds, invalidOriginNames][countNumber];
    },
    aggregate(pipeline) {
      assert.deepEqual(JSON.parse(JSON.stringify(pipeline)), [
        { $match: { origenId: { $type: 'objectId' } } },
        { $group: {
          _id: { empresaId: '$empresaId', origen: '$origen', origenId: '$origenId' },
          count: { $sum: 1 }
        } },
        { $match: { count: { $gt: 1 } } },
        { $count: 'groups' }
      ]);
      calls.push('aggregate');
      return { toArray() { return duplicateGroups ? [{ groups: duplicateGroups }] : []; } };
    }
  };
  const database = {
    getSiblingDB(dbName) {
      assert.equal(dbName, name);
      return {
        getCollection(collectionName) {
          assert.equal(collectionName, 'ventas');
          return collection;
        }
      };
    }
  };
  const output = [];
  const run = () => vm.runInNewContext(source, {
    db: database,
    process: { env: { GRUK_ENTERPRISE_DB: name } },
    printjson(value) { output.push(JSON.parse(JSON.stringify(value))); }
  }, { timeout: 1000 });
  return { run, calls, output };
}

test('P0-04 preflight rejects missing or unsafe explicit database names before DB access', () => {
  for (const name of ['', 'personal/db', 'other.db', 'enterprise;drop']) {
    const ctx = preflight({ name });
    assert.throws(ctx.run, /Explicit GRUK_ENTERPRISE_DB required/);
    assert.deepEqual(ctx.calls, []);
  }
});

test('P0-04 preflight reports readiness without writing to MongoDB', () => {
  const ctx = preflight();
  ctx.run();
  assert.deepEqual(ctx.calls, ['getIndexes', 'countDocuments', 'countDocuments', 'countDocuments', 'countDocuments', 'aggregate']);
  assert.equal(ctx.output[1].readyForIndexBuild, true);
  assert.equal(ctx.output[1].duplicateGroups, 0);
});

test('P0-04 preflight blocks migration readiness for missing tenants or duplicate scoped keys', () => {
  for (const anomalies of [{ missingTenant: 1 }, { duplicateGroups: 2 }, { missingTenant: 1, duplicateGroups: 2 }]) {
    const ctx = preflight(anomalies);
    assert.throws(ctx.run, /Data anomalies block index migration/);
    assert.equal(ctx.output[1].readyForIndexBuild, false);
  }
});


test('P0-04 preflight blocks legacy global unique origin indexes without mutating data', () => {
  const ctx = preflight({ indexes: [
    { name: '_id_' },
    { name: 'legacy_origin_unique', unique: true, key: { origen: 1, origenId: 1 } }
  ] });
  assert.throws(ctx.run, /Data anomalies block index migration/);
  assert.deepEqual(ctx.output[1].legacyGlobalUniqueIndexes, ['legacy_origin_unique']);
  assert.equal(ctx.output[1].readyForIndexBuild, false);
  assert.deepEqual(ctx.calls, ['getIndexes', 'countDocuments', 'countDocuments', 'countDocuments', 'countDocuments', 'aggregate']);
});

test('P0-04 preflight accepts tenant-scoped unique origin indexes', () => {
  const ctx = preflight({ indexes: [
    { name: 'tenant_origin_unique', unique: true, key: { empresaId: 1, origen: 1, origenId: 1 }, partialFilterExpression: { origenId: { $type: 'objectId' } } }
  ] });
  ctx.run();
  assert.deepEqual(ctx.output[1].legacyGlobalUniqueIndexes, []);
  assert.equal(ctx.output[1].readyForIndexBuild, true);
});


test('P0-04 preflight blocks invalid legacy origin IDs excluded by partial index', () => {
  const ctx = preflight({ invalidOriginIds: 1 });
  assert.throws(ctx.run, /Data anomalies block index migration/);
  assert.equal(ctx.output[1].invalidOriginIds, 1);
  assert.equal(ctx.output[1].readyForIndexBuild, false);
});

test('P0-04 preflight scans originless sales for missing enterprise ownership', () => {
  const ctx = preflight({ missingTenant: 1 });
  assert.throws(ctx.run, /Data anomalies block index migration/);
  assert.equal(ctx.output[1].missingTenant, 1);
  assert.deepEqual(ctx.calls, ['getIndexes', 'countDocuments', 'countDocuments', 'countDocuments', 'countDocuments', 'aggregate']);
});

test('P0-04 preflight detects legacy unique origin indexes regardless of key order', () => {
  const ctx = preflight({ indexes: [
    { name: 'legacy_reverse', unique: true, key: { origenId: 1, origen: 1 } },
    { name: 'legacy_compound', unique: true, key: { sedeId: 1, origen: 1, origenId: 1 } },
    { name: 'nonunique_origin', key: { origen: 1, origenId: 1 } },
    { name: 'tenant_scoped', unique: true, key: { origen: 1, empresaId: 1, origenId: 1 } }
  ] });
  assert.throws(ctx.run, /Data anomalies block index migration/);
  assert.deepEqual(ctx.output[1].legacyGlobalUniqueIndexes, ['legacy_reverse', 'legacy_compound']);
  assert.equal(ctx.output[1].readyForIndexBuild, false);
});

test('P0-04 preflight refuses Personal and Blushea database names before any reads', () => {
  for (const name of ['gruk_personal', 'finanzas_personales', 'blushea', 'GRUK-BLUSHEA-prod', 'personal-prod']) {
    const ctx = preflight({ name });
    assert.throws(ctx.run, /Non-enterprise database prohibited/);
    assert.deepEqual(ctx.calls, []);
  }
});

test('P0-04 preflight blocks scoped unique indexes that reject originless sales', () => {
  const ctx = preflight({ indexes: [
    { name: 'tenant_origin_unfiltered', unique: true, key: { empresaId: 1, origen: 1, origenId: 1 } }
  ] });
  assert.throws(ctx.run, /Data anomalies block index migration/);
  assert.deepEqual(ctx.output[1].incompatibleTenantUniqueIndexes, ['tenant_origin_unfiltered']);
  assert.equal(ctx.output[1].readyForIndexBuild, false);
  assert.deepEqual(ctx.calls, ['getIndexes', 'countDocuments', 'countDocuments', 'countDocuments', 'countDocuments', 'aggregate']);
});


test('P0-04 preflight rejects scoped unique indexes with extra keys that weaken origin uniqueness', () => {
  const ctx = preflight({ indexes: [
    { name: 'tenant_origin_sede_unique', unique: true, key: { empresaId: 1, sedeId: 1, origen: 1, origenId: 1 }, partialFilterExpression: { origenId: { $type: 'objectId' } } }
  ] });
  assert.throws(ctx.run, /Data anomalies block index migration/);
  assert.deepEqual(ctx.output[1].incompatibleTenantUniqueIndexes, ['tenant_origin_sede_unique']);
  assert.equal(ctx.output[1].readyForIndexBuild, false);
});


test('P0-04 preflight blocks descending global unique origin indexes', () => {
  const ctx = preflight({ indexes: [
    { name: 'legacy_descending', unique: true, key: { origen: -1, origenId: -1 } },
    { name: 'legacy_mixed', unique: true, key: { origenId: -1, origen: 1 } },
    { name: 'nonunique_descending', key: { origen: -1, origenId: -1 } }
  ] });
  assert.throws(ctx.run, /Data anomalies block index migration/);
  assert.deepEqual(ctx.output[1].legacyGlobalUniqueIndexes, ['legacy_descending', 'legacy_mixed']);
  assert.equal(ctx.output[1].readyForIndexBuild, false);
});


test('P0-04 preflight distinguishes clean data from actual target index presence', () => {
  const absent = preflight();
  absent.run();
  assert.equal(absent.output[1].readyForIndexBuild, true);
  assert.equal(absent.output[1].targetIndexPresent, false);
  const present = preflight({ indexes: [
    { name: 'tenant_origin_unique', unique: true, key: { empresaId: 1, origen: 1, origenId: 1 }, partialFilterExpression: { origenId: { $type: 'objectId' } } }
  ] });
  present.run();
  assert.equal(present.output[1].targetIndexPresent, true);
  const wrong = preflight({ indexes: [
    { name: 'tenant_origin_nonunique', key: { empresaId: 1, origen: 1, origenId: 1 }, partialFilterExpression: { origenId: { $type: 'objectId' } } }
  ] });
  wrong.run();
  assert.equal(wrong.output[1].targetIndexPresent, false);
});

test('P0-04 recognizes reordered tenant uniqueness and rejects descending lookalikes', () => {
  const reordered = preflight({ indexes: [
    { name: 'reordered_target', unique: true, key: { origenId: 1, empresaId: 1, origen: 1 }, partialFilterExpression: { origenId: { $type: 'objectId' } } }
  ] });
  reordered.run();
  assert.equal(reordered.output[1].targetIndexPresent, true);
  assert.deepEqual(reordered.output[1].incompatibleTenantUniqueIndexes, []);
  const descending = preflight({ indexes: [
    { name: 'descending_target', unique: true, key: { origenId: -1, empresaId: 1, origen: 1 }, partialFilterExpression: { origenId: { $type: 'objectId' } } }
  ] });
  descending.run();
  assert.equal(descending.output[1].targetIndexPresent, false);
});


test('P0-04 preflight blocks missing or malformed site ownership without writes', () => {
  const ctx = preflight({ invalidSiteIds: 3 });
  assert.throws(ctx.run, /Data anomalies block index migration/);
  assert.equal(ctx.output[1].invalidSiteIds, 3);
  assert.equal(ctx.output[1].readyForIndexBuild, false);
  assert.deepEqual(ctx.calls, ['getIndexes', 'countDocuments', 'countDocuments', 'countDocuments', 'countDocuments', 'aggregate']);
});


test('P0-04 distinguishes data readiness from conservative legacy-index migration gate', () => {
  const legacy = preflight({ indexes: [
    { name: 'legacy_origin_unique', unique: true, key: { origen: 1, origenId: 1 } }
  ] });
  assert.throws(legacy.run, /Data anomalies block index migration/);
  assert.equal(legacy.output[1].dataReadyForIndexBuild, true);
  assert.equal(legacy.output[1].readyForIndexBuild, false);
  const badData = preflight({ missingTenant: 1 });
  assert.throws(badData.run, /Data anomalies block index migration/);
  assert.equal(badData.output[1].dataReadyForIndexBuild, false);
  const clean = preflight();
  clean.run();
  assert.equal(clean.output[1].dataReadyForIndexBuild, true);
  assert.equal(clean.output[1].readyForIndexBuild, true);
});


test('P0-04 blocks ObjectId origins without a valid origin name', () => {
  const ctx = preflight({ invalidOriginNames: 2 });
  assert.throws(ctx.run, /Data anomalies block index migration/);
  assert.equal(ctx.output[1].invalidOriginNames, 2);
  assert.equal(ctx.output[1].dataReadyForIndexBuild, false);
  assert.equal(ctx.output[1].readyForIndexBuild, false);
});
// Whitespace-only origins must not silently pass the migration preflight.
test('P0-04 rejects blank and whitespace-only origin names via MongoDB regex', () => {
  const ctx = preflight({ invalidOriginNames: 1 });
  assert.throws(ctx.run, /Data anomalies block index migration/);
  assert.equal(ctx.output[1].invalidOriginNames, 1);
  assert.equal(ctx.output[1].dataReadyForIndexBuild, false);
});
