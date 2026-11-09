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
    await assert.rejects(
      Model.updateOne({ _id: persisted._id }, [{ $set: { offlineEventId: "evt-pipeline-forged" } }], { updatePipeline: true }),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.updateOne({ _id: persisted._id }, [{ $unset: "empresaId" }], { updatePipeline: true }),
      /Offline tenant identity/
    );
    // Aggregation pipeline stages can rewrite the entire document without
    // naming an offline identity field in their immediate stage keys.
    for (const stage of [
      { $replaceRoot: { newRoot: { producto: "forged" } } },
      { $replaceWith: { producto: "forged" } },
      { $project: { empresaId: 0 } }
    ]) {
      await assert.rejects(
        Model.updateOne({ _id: persisted._id }, [stage], { updatePipeline: true }),
        /Offline tenant identity/
      );
      await assert.rejects(
        Model.bulkWrite([{ updateOne: { filter: { _id: persisted._id }, update: [stage] } }]),
        /Offline tenant identity/
      );
    }
    // MongoDB accepts pipeline $unset as an array, and $rename targets may
    // refer to dotted paths. Both must preserve offline tenant identity.
    await assert.rejects(
      Model.updateOne({ _id: persisted._id }, [{ $unset: ["producto", "empresaId"] }], { updatePipeline: true }),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.bulkWrite([{ updateOne: { filter: { _id: persisted._id }, update: [{ $unset: ["producto", "sedeId"] }] } }]),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.updateOne({ _id: persisted._id }, { $rename: { producto: "empresaId.nested" } }),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.bulkWrite([{ updateOne: { filter: { _id: persisted._id }, update: { $rename: { producto: "offlineEventId.nested" } } } }]),
      /Offline tenant identity/
    );
    // Upsert is another insertion path: $setOnInsert must not create an
    // offline retry identity without passing the tenant-safe creation path.
    // Reject the entire unordered batch before a legitimate companion write.
    await assert.rejects(
      Model.updateOne({ offlineEventId: "evt-upsert-forged" }, {
        $set: { estado: "pendiente" },
        $setOnInsert: { empresaId: companyB, sedeId: "s9", offlineEventId: "evt-upsert-forged" }
      }, { upsert: true }),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.bulkWrite([
        { updateOne: { filter: { _id: persisted._id }, update: { $set: { estado: "entregado" } } } },
        { updateOne: { filter: { offlineEventId: "evt-bulk-upsert-forged" }, update: {
          $setOnInsert: { empresaId: companyB, sedeId: "s9", offlineEventId: "evt-bulk-upsert-forged" }
        }, upsert: true } }
      ], { ordered: false }),
      /Offline tenant identity/
    );
    assert.equal(await Model.countDocuments({ offlineEventId: { $in: ["evt-upsert-forged", "evt-bulk-upsert-forged"] } }), 0);
    assert.equal((await Model.findById(persisted._id)).estado, "pendiente");

    // An upsert can derive offlineEventId from its equality filter even when
    // the update document never names an identity field. Reject pre-dispatch.
    await assert.rejects(
      Model.updateOne({ offlineEventId: "evt-filter-upsert", empresaId: companyA, sedeId: "s1" },
        { $set: { estado: "pendiente" } }, { upsert: true }),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.findOneAndUpdate({ offlineEventId: "evt-filter-find-upsert", empresaId: companyA, sedeId: "s1" },
        { $set: { estado: "pendiente" } }, { upsert: true }),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.bulkWrite([
        { updateOne: { filter: { _id: persisted._id }, update: { $set: { estado: "entregado" } } } },
        { updateOne: { filter: { offlineEventId: "evt-filter-bulk-upsert", empresaId: companyA, sedeId: "s1" },
          update: { $set: { estado: "pendiente" } }, upsert: true } }
      ], { ordered: false }),
      /Offline tenant identity/
    );
    assert.equal(await Model.countDocuments({ offlineEventId: { $in: [
      "evt-filter-upsert", "evt-filter-find-upsert", "evt-filter-bulk-upsert"
    ] } }), 0);
    assert.equal((await Model.findById(persisted._id)).estado, "pendiente");

    // Full-document replacement must not bypass tenant identity protections.
    await assert.rejects(
      Model.replaceOne({ _id: persisted._id }, order(companyB, "s9", "forged-replace")),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.findOneAndReplace({ _id: persisted._id }, order(companyB, "s9", "forged-find-replace")),
      /Offline tenant identity/
    );
    assert.equal((await Model.findById(persisted._id)).sedeId, "s1");
    assert.equal(String((await Model.findById(persisted._id)).empresaId), String(companyA));

    // Document.save() does not execute query update middleware. Immutable
    // offline identity must also survive this common Mongoose write path.
    for (const [field, value] of [
      ["empresaId", companyB],
      ["sedeId", "forged-site"],
      ["offlineEventId", "forged-event"]
    ]) {
      const document = await Model.findById(persisted._id);
      document.set(field, value);
      await assert.rejects(document.save(), /Offline tenant identity/);
    }
    // Clearing the key used to bypass validation's missing-event early return.
    for (const removedValue of [undefined, null]) {
      const document = await Model.findById(persisted._id);
      document.offlineEventId = removedValue;
      await assert.rejects(document.save(), /Offline tenant identity/);
    }
    assert.equal((await Model.findById(persisted._id)).offlineEventId, "evt-concurrent");
    const afterRejectedSaves = await Model.findById(persisted._id);
    assert.equal(String(afterRejectedSaves.empresaId), String(companyA));
    assert.equal(afterRejectedSaves.sedeId, "s1");
    assert.equal(afterRejectedSaves.offlineEventId, "evt-concurrent");
    const allowedDocument = await Model.findById(persisted._id);
    allowedDocument.observaciones = "actualización legítima";
    await allowedDocument.save();
    assert.equal((await Model.findById(persisted._id)).observaciones, "actualización legítima");

    await Model.updateOne({ _id: persisted._id }, { $set: { estado: "preparando" } });
    assert.equal((await Model.findById(persisted._id)).estado, "preparando");
    assert.equal((await Model.findById(persisted._id)).offlineEventId, "evt-concurrent");

    // bulkWrite skips updateOne middleware: protect the same identity here.
    await assert.rejects(
      Model.bulkWrite([{ updateOne: { filter: { _id: persisted._id }, update: { $set: { sedeId: "forged" } } } }]),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.bulkWrite([{ updateMany: { filter: { empresaId: companyA }, update: { $unset: { offlineEventId: 1 } } } }]),
      /Offline tenant identity/
    );
    await assert.rejects(
      Model.bulkWrite([{ replaceOne: { filter: { _id: persisted._id }, replacement: order(companyA, "s1", "replacement") } }]),
      /Offline tenant identity/
    );
    await Model.bulkWrite([{ updateOne: { filter: { _id: persisted._id }, update: { $set: { estado: "listo" } } } }]);
    assert.equal((await Model.findById(persisted._id)).estado, "listo");
    assert.equal((await Model.findById(persisted._id)).offlineEventId, "evt-concurrent");

    // Reject the entire mixed bulk batch before sending any writes: an
    // allowed status change must not be partially applied before a forged
    // tenant-identity update in the same bulkWrite call.
    await assert.rejects(
      Model.bulkWrite([
        { updateOne: { filter: { _id: persisted._id }, update: { $set: { estado: "entregado" } } } },
        { updateOne: { filter: { _id: persisted._id }, update: { $set: { sedeId: "other-site" } } } }
      ], { ordered: false }),
      /Offline tenant identity/
    );
    assert.equal((await Model.findById(persisted._id)).estado, "listo");
    assert.equal((await Model.findById(persisted._id)).sedeId, "s1");

    // Multi-document query updates must enforce the same immutable identity.
    await assert.rejects(
      Model.updateMany({ empresaId: companyA }, { $set: { empresaId: companyB } }),
      /Offline tenant identity/
    );
    assert.equal(await Model.countDocuments({ empresaId: companyA, offlineEventId: "evt-concurrent" }), 2);

    // bulkWrite insertOne must validate tenant scope too; query-update guards
    // alone do not cover insertion paths. Failed insertion must persist nothing.
    await assert.rejects(
      Model.bulkWrite([{ insertOne: { document: order(null, "", "evt-invalid-tenant") } }]),
      /Offline tenant identity|empresaId|sedeId|validation/i
    );
    assert.equal(await Model.countDocuments({ offlineEventId: "evt-invalid-tenant" }), 0);

    // Bulk insertion must enforce the same scope and canonical event key as
    // Model.create; otherwise a retry could be stored under an ambiguous key.
    for (const invalid of [
      order(companyA, "", "evt-no-site"),
      order(null, "s1", "evt-no-company"),
      order(companyA, "s1", "  evt-spaces  "),
      order(companyA, "s1", "")
    ]) {
      await assert.rejects(
        Model.bulkWrite([{ insertOne: { document: invalid } }]),
        /Offline tenant identity|offlineEventId|empresaId|sedeId|validation/i
      );
    }
    for (const key of ["evt-no-site", "evt-no-company", "  evt-spaces  ", ""]) {
      assert.equal(await Model.countDocuments({ offlineEventId: key }), 0);
    }
    await Model.bulkWrite([{ insertOne: { document: order(companyA, "s1", "evt-valid-bulk") } }]);
    assert.equal(await Model.countDocuments({ empresaId: companyA, sedeId: "s1", offlineEventId: "evt-valid-bulk" }), 1);

    // Even unordered batches must not partially persist a valid offline event
    // when another insert in the same batch has an invalid tenant identity.
    await assert.rejects(
      Model.bulkWrite([
        { insertOne: { document: order(companyA, "s1", "evt-mixed-valid") } },
        { insertOne: { document: order(null, "", "evt-mixed-invalid") } }
      ], { ordered: false }),
      /Offline tenant identity/
    );
    assert.equal(await Model.countDocuments({ offlineEventId: { $in: ["evt-mixed-valid", "evt-mixed-invalid"] } }), 0);

    // Mongoose may reject a malformed ObjectId only after dispatching other
    // operations in an unordered bulk batch. Preflight must reject the whole
    // batch before any valid companion insert reaches MongoDB.
    await assert.rejects(
      Model.bulkWrite([
        { insertOne: { document: order(companyA, "s1", "evt-malformed-companion") } },
        { insertOne: { document: order("not-an-object-id", "s1", "evt-malformed-company") } }
      ], { ordered: false }),
      /Offline tenant identity/
    );
    assert.equal(await Model.countDocuments({
      offlineEventId: { $in: ["evt-malformed-companion", "evt-malformed-company"] }
    }), 0);

    await Model.create(order(null, "", undefined));
    await Model.create(order(null, "", undefined));
    assert.equal(await Model.countDocuments({ offlineEventId: { $exists: false } }), 2);
  } finally {
    try { await connection.dropCollection(collection); } finally { await connection.close(); }
  }
});
