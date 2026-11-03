"use strict";
// Real MongoDB integration: run with GRUK_TEST_MONGO_URI=mongodb://127.0.0.1:27017
// Uses a disposable, random database; never connects to the application database.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { MongoClient } = require("mongodb");
const { issueToken, resolveMesaQrRead } = require("../../core/security/qrMesaRead.service");

const uri = process.env.GRUK_TEST_MONGO_URI;
const secret = "integration-qr-tenant-secret-".repeat(2);
const a = "aaaaaaaaaaaaaaaaaaaaaaaa", b = "bbbbbbbbbbbbbbbbbbbbbbbb";
const siteA = "cccccccccccccccccccccccc", siteB = "dddddddddddddddddddddddd";
const restaurantId = "integration-qr-restaurant";
const now = () => 1793350000000;
function model(collection) {
  return { findOne(filter) {
    return { select() { return { lean() { return collection.findOne(filter); } }; } };
  } };
}
test("P0-70: real Mongo queries isolate QR orders across enterprises, legacy records and sites", {
  skip: !uri && "Set GRUK_TEST_MONGO_URI to run real Mongo integration"
}, async () => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  const dbName = "gruk_qr_test_" + crypto.randomBytes(8).toString("hex");
  await client.connect();
  const db = client.db(dbName);
  try {
    const restaurants = db.collection("restaurants");
    const sites = db.collection("sites");
    const orders = db.collection("orders");
    await restaurants.insertMany([
      { _id: "ra", empresaId: a, restaurantId },
      { _id: "rb", empresaId: b, restaurantId }
    ]);
    await sites.insertMany([
      { _id: siteA, empresaId: a, restauranteId: restaurantId, codigoSede: "local" },
      { _id: siteB, empresaId: b, restauranteId: restaurantId, codigoSede: "local" },
      { _id: "ffffffffffffffffffffffff", empresaId: a, restauranteId: restaurantId, codigoSede: siteB }
    ]);
    await orders.insertMany([
      { _id: "a-site", empresaId: a, restaurantId, mesa: 4, sedeId: "local" },
      { _id: "b-site", empresaId: b, restaurantId, mesa: 4, sedeId: "local" },
      { _id: "legacy-site", restaurantId, mesa: 4, sedeId: "local" },
      { _id: "a-other", empresaId: a, restaurantId, mesa: 4, sedeId: siteB },
      { _id: "a-nosite", empresaId: a, restaurantId, mesa: 4, sedeId: "" },
      { _id: "b-nosite", empresaId: b, restaurantId, mesa: 4, sedeId: "" },
      { _id: "legacy-nosite", restaurantId, mesa: 4, sedeId: "" },
      { _id: "a-nullsite", empresaId: a, restaurantId, mesa: 4, sedeId: null },
      { _id: "b-nullsite", empresaId: b, restaurantId, mesa: 4, sedeId: null },
      { _id: "legacy-nullsite", restaurantId, mesa: 4, sedeId: null }
    ]);
    const models = { secret, now, RestauranteModel: model(restaurants), SedeModel: model(sites) };
    for (const [enterprise, site, expected] of [[a, siteA, "a-site"], [b, siteB, "b-site"]]) {
      const qrToken = issueToken({ empresaId: enterprise, restaurantId, mesa: 4, sedeId: site }, { secret, now }).token;
      const result = await resolveMesaQrRead({ restaurantId, mesa: 4, sedeId: "local", qrToken }, models);
      assert.equal(result.status, 200);
      const found = await orders.find(result.filter).project({ _id: 1 }).toArray();
      assert.deepEqual(found.map(x => x._id), [expected]);
    }
    // A site whose legacy alias equals another site's ObjectId must never match that alias.
    const ambiguousToken = issueToken({ empresaId: a, restaurantId, mesa: 4, sedeId: "ffffffffffffffffffffffff" }, { secret, now }).token;
    const ambiguous = await resolveMesaQrRead({ restaurantId, mesa: 4, sedeId: siteB, qrToken: ambiguousToken }, models);
    assert.equal(ambiguous.status, 403);
    assert.equal(ambiguous.filter, undefined);
    // Tampered bearer capabilities must not produce a MongoDB query filter.
    const tampered = ambiguousToken.slice(0, -1) + (ambiguousToken.endsWith("A") ? "B" : "A");
    const deniedTampered = await resolveMesaQrRead({ restaurantId, mesa: 4, qrToken: tampered }, models);
    assert.equal(deniedTampered.status, 401);
    assert.equal(deniedTampered.filter, undefined);
    const qrToken = issueToken({ empresaId: a, restaurantId, mesa: 4 }, { secret, now }).token;
    const result = await resolveMesaQrRead({ restaurantId, mesa: 4, qrToken }, models);
    assert.equal(result.status, 200);
    const found = await orders.find(result.filter).project({ _id: 1 }).toArray();
    assert.deepEqual(found.map(x => x._id).sort(), ["a-nosite", "a-nullsite"].sort());
    // Symmetric no-site isolation: B must not see A, legacy, or wrong-site orders.
    const tokenB = issueToken({ empresaId: b, restaurantId, mesa: 4 }, { secret, now }).token;
    const readB = await resolveMesaQrRead({ restaurantId, mesa: 4, qrToken: tokenB }, models);
    assert.equal(readB.status, 200);
    assert.deepEqual((await orders.find(readB.filter).project({ _id: 1 }).toArray()).map(x => x._id).sort(), ["b-nosite", "b-nullsite"].sort());
    // A QR for an unknown site must fail closed even if orders exist for its alias.
    const missingSiteToken = issueToken({ empresaId: a, restaurantId, mesa: 4, sedeId: "eeeeeeeeeeeeeeeeeeeeeeee" }, { secret, now }).token;
    const missingSite = await resolveMesaQrRead({ restaurantId, mesa: 4, sedeId: "local", qrToken: missingSiteToken }, models);
    assert.notEqual(missingSite.status, 200);
    assert.equal(missingSite.filter, undefined);
    const wrong = await resolveMesaQrRead({ restaurantId, mesa: 4, sedeId: "local", qrToken }, models);
    assert.equal(wrong.status, 403);
    assert.equal(wrong.filter, undefined);
    for (const invalid of [
      { restaurantId, mesa: 5, qrToken },
      { restaurantId: "another-restaurant", mesa: 4, qrToken }
    ]) {
      const denied = await resolveMesaQrRead(invalid, models);
      assert.equal(denied.status, 403);
      assert.equal(denied.filter, undefined);
    }
  } finally {
    await db.dropDatabase();
    await client.close();
  }
});
