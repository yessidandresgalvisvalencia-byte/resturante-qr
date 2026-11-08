"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Pedido = require("../../models/pedido");

// Opt-in integration test: never connect to production or silently claim coverage.
// CI must supply a disposable replica-set database via GRUK_TEST_MONGO_URI.
const uri = process.env.GRUK_TEST_MONGO_URI;
test("MongoDB enforces tenant-scoped offline retry uniqueness under concurrency", { skip: !uri && "GRUK_TEST_MONGO_URI not configured" }, async () => {
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const collection = "gruk_offline_retry_" + new mongoose.Types.ObjectId().toHexString();
  const Model = connection.model("OfflineRetryIntegration", Pedido.schema.clone(), collection);
  const companyA = new mongoose.Types.ObjectId();
  const companyB = new mongoose.Types.ObjectId();
  const order = (empresaId, sedeId, offlineEventId) => ({
    empresaId, sedeId, offlineEventId,
    mesa: 1, producto: "Prueba", precio: 1000, precioUnitario: 1000
  });
  try {
    await Model.createCollection();
    await Model.init();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => Model.create(order(companyA, "s1", "evt-concurrent")))
    );
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(results.filter(r => r.status === "rejected").length, 7);
    for (const result of results.filter(r => r.status === "rejected")) {
      assert.equal(result.reason.code, 11000, "duplicate retries must fail at MongoDB unique index");
    }
    assert.equal(await Model.countDocuments({ empresaId: companyA, sedeId: "s1", offlineEventId: "evt-concurrent" }), 1);

    await Model.create(order(companyA, "s2", "evt-concurrent"));
    await Model.create(order(companyB, "s1", "evt-concurrent"));
    assert.equal(await Model.countDocuments({ offlineEventId: "evt-concurrent" }), 3);


    // Query updates do not run document validation; they must not mutate
    // offline retry identity, even when a caller supplies runValidators.
    const persisted = await Model.findOne({ empresaId: companyA, sedeId: "s1", offlineEventId: "evt-concurrent" });
    await assert.rejects(
      Model.updateOne({ _id: persisted._id }, { $set: { offlineEventId: "evt-forged" } }),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.findOneAndUpdate({ _id: persisted._id }, { $unset: { empresaId: 1 } }),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.updateMany({ empresaId: companyA }, { $rename: { producto: "sedeId" } }),
      /Offline tenant identity/
    );
    await Model.updateOne({ _id: persisted._id }, { $set: { estado: "preparando" } });
    assert.equal((await Model.findById(persisted._id)).estado, "preparando");
    assert.equal((await Model.findById(persisted._id)).offlineEventId, "evt-concurrent");

    await Model.create(order(null, "", undefined));
    await Model.create(order(null, "", undefined));
    assert.equal(await Model.countDocuments({ offlineEventId: { $exists: false } }), 2);
  } finally {
    try { await connection.dropCollection(collection); } finally { await connection.close(); }
  }
});
