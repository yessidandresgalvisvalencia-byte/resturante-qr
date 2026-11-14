'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../scripts/gruk/p0-04-venta-index-preflight.js'), 'utf8');

function preflight({ name = 'gruk_enterprise_test', missingTenant = 0, duplicateGroups = 0, invalidOriginIds = 0, indexes = [{ name: '_id_' }] } = {}) {
  const calls = [];
  const collection = {
    getIndexes() { calls.push('getIndexes'); return indexes; },
    countDocuments(query) {
      const normalized = JSON.parse(JSON.stringify(query));
      const missingTenantQuery = { empresaId: { $not: { $type: 'objectId' } } };
      const invalidOriginQuery = { origenId: { $exists: true, $nin: [null], $not: { $type: 'objectId' } } };
      const countNumber = calls.filter(call => call === 'countDocuments').length;
      assert.deepEqual(normalized, countNumber === 0 ? missingTenantQuery : invalidOriginQuery);
      calls.push('countDocuments');
      return countNumber === 0 ? missingTenant : invalidOriginIds;
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
  assert.deepEqual(ctx.calls, ['getIndexes', 'countDocuments', 'countDocuments', 'aggregate']);
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
  assert.deepEqual(ctx.calls, ['getIndexes', 'countDocuments', 'countDocuments', 'aggregate']);
});

test('P0-04 preflight accepts tenant-scoped unique origin indexes', () => {
  const ctx = preflight({ indexes: [
    { name: 'tenant_origin_unique', unique: true, key: { empresaId: 1, origen: 1, origenId: 1 } }
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
  assert.deepEqual(ctx.calls, ['getIndexes', 'countDocuments', 'countDocuments', 'aggregate']);
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
