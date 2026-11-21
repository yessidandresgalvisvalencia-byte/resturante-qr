"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Pedido = require("../../models/pedido");

// Driver-level integration contract. Mongoose middleware does not run for
// Model.collection operations. This test deliberately exercises MongoDB itself.
// It does NOT certify that every application caller supplies these predicates.
const uri = process.env.GRUK_TEST_MONGO_URI;
test("raw MongoDB offline writes require tenant-scoped predicates and preserve retry uniqueness", {
  skip: !uri && "GRUK_TEST_MONGO_URI not configured"
}, async () => {
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const collectionName = "gruk_raw_offline_" + new mongoose.Types.ObjectId().toHexString();
  const Model = connection.model("RawOfflineTenantContract", Pedido.schema.clone(), collectionName);
  const companyA = new mongoose.Types.ObjectId();
  const companyB = new mongoose.Types.ObjectId();
  const order = (empresaId, sedeId, offlineEventId) => ({
    empresaId, sedeId, offlineEventId, mesa: 1, producto: "Prueba",
    precio: 1000, precioUnitario: 1000, estado: "pendiente"
  });
  try {
    await Model.createCollection();
    await Model.init();
    const raw = Model.collection;
    const first = await raw.insertOne(order(companyA, "s1", "same-event"));
    await raw.insertOne(order(companyB, "s1", "same-event"));
    await raw.insertOne(order(companyA, "s2", "same-event"));
    await assert.rejects(
      raw.insertOne(order(companyA, "s1", "same-event")),
      error => error && error.code === 11000
    );
    assert.equal(await raw.countDocuments({ offlineEventId: "same-event" }), 3);

    // A driver-level update must carry the authorized company and site in
    // its filter, not merely the document ID or client-supplied event key.
    const denied = await raw.updateOne({
      _id: first.insertedId, empresaId: companyB, sedeId: "s1"
    }, { $set: { estado: "entregado" } });
    assert.equal(denied.matchedCount, 0);
    assert.equal(denied.modifiedCount, 0);

    const allowed = await raw.updateOne({
      _id: first.insertedId, empresaId: companyA, sedeId: "s1"
    }, { $set: { estado: "preparando" } });
    assert.equal(allowed.matchedCount, 1);
    assert.equal(allowed.modifiedCount, 1);
    assert.equal((await raw.findOne({ _id: first.insertedId })).estado, "preparando");
    assert.equal(await raw.countDocuments({ empresaId: companyB, estado: "pendiente" }), 1);
    assert.equal(await raw.countDocuments({ empresaId: companyA, sedeId: "s2", estado: "pendiente" }), 1);
  } finally {
    try { await connection.dropCollection(collectionName); } finally { await connection.close(); }
  }
});
