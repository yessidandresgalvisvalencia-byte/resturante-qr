'use strict';

// Run only against a dedicated disposable MongoDB instance:
// GRUK_TEST_MONGO_URI=mongodb://127.0.0.1:27017 node --test test/gruk/p0-04-mongodb-tenant-isolation.integration.test.js
// Never point this test at production. It creates and drops an isolated database.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('node:crypto');

const uri = process.env.GRUK_TEST_MONGO_URI;
const permitted = uri && /^mongodb(?:\+srv)?:\/\//.test(uri) &&
  !/mongodb(?:\+srv)?:\/\/[^/]+\/[^?]+/.test(uri); // URI must not name an existing database

test('P0-04: real MongoDB enforces tenant and branch-scoped catalog reads', {
  skip: !permitted && 'Requires GRUK_TEST_MONGO_URI pointing to a disposable server with no database in URI'
}, async () => {
  const dbName = 'gruk_p004_isolation_' + crypto.randomBytes(10).toString('hex');
  const conn = mongoose.createConnection(uri, { dbName, serverSelectionTimeoutMS: 5000 });
  try {
    await conn.asPromise();
    const schema = new mongoose.Schema({
      empresaId: mongoose.Schema.Types.ObjectId,
      sedeId: { type: mongoose.Schema.Types.ObjectId, default: null },
      costoUnitario: Number
    }, { strict: true });
    const Products = conn.model('P004Product', schema);
    const tenantA = new mongoose.Types.ObjectId();
    const tenantB = new mongoose.Types.ObjectId();
    const branchA = new mongoose.Types.ObjectId();
    const branchB = new mongoose.Types.ObjectId();
    const [own, sibling, foreign, global] = await Products.create([
      { empresaId: tenantA, sedeId: branchA, costoUnitario: 10 },
      { empresaId: tenantA, sedeId: branchB, costoUnitario: 20 },
      { empresaId: tenantB, sedeId: branchA, costoUnitario: 30 },
      { empresaId: tenantA, sedeId: null, costoUnitario: 40 }
    ]);
    const scoped = await Products.find({
      empresaId: tenantA, sedeId: { $in: [branchA, null] }
    }).lean();
    assert.deepEqual(scoped.map(x => String(x._id)).sort(),
      [own, global].map(x => String(x._id)).sort());
    assert.equal(await Products.findOne({
      _id: sibling._id, empresaId: tenantA, sedeId: { $in: [branchA, null] }
    }).lean(), null);
    assert.equal(await Products.findOne({
      _id: foreign._id, empresaId: tenantA, sedeId: { $in: [branchA, null] }
    }).lean(), null);
    assert.equal(await Products.countDocuments({ empresaId: tenantA, sedeId: null }), 1);
  } finally {
    if (conn.readyState === 1) await conn.dropDatabase();
    await conn.close();
  }
});
