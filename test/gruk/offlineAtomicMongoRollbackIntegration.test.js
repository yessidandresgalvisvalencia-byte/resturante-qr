"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { MongoClient } = require("mongodb");
const { digest } = require("../../core/offline/offlineInbox.service");
const { processPendingOfflinePedido } = require("../../core/offline/offlinePedidoAtomic.service");

const uri = process.env.GRUK_TEST_MONGO_URI;
const companyId = "507f1f77bcf86cd799439011";
const context = { empresaId: companyId, sedeId: "sede-rollback", actorId: "actor-rollback" };
const event = {
  ...context, eventId: "01ARZ3NDEKTSV4RRFFQ69G5FAY", tipo: "PEDIDO_REGISTRADO",
  deviceId: "device-rollback", occurredAt: "2026-11-09T00:00:00.000Z",
  schemaVersion: 1, payload: {}
};

test("Mongo transaction rolls back an inserted offline order when inbox claim loses the race", {
  skip: !uri && "GRUK_TEST_MONGO_URI not configured"
}, async () => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  const dbName = "gruk_offline_rollback_" + randomBytes(8).toString("hex");
  await client.connect();
  const actualDb = client.db(dbName);
  try {
    await actualDb.collection("gruk_offline_inbox").insertOne({
      ...event, eventHash: digest(event), status: "PENDIENTE"
    });
    // Keep real MongoDB reads, writes, and transaction boundaries. Force the
    // final compare-and-swap claim to lose after the order insert.
    const db = {
      collection(name) {
        const collection = actualDb.collection(name);
        if (name !== "gruk_offline_inbox") return collection;
        return {
          findOne: (...args) => collection.findOne(...args),
          updateOne: async () => ({ matchedCount: 0, modifiedCount: 0 })
        };
      }
    };
    const session = client.startSession();
    try {
      await assert.rejects(
        processPendingOfflinePedido({ db, session, event, context }),
        error => error?.code === "OFFLINE_CLAIM_CONFLICT"
      );
    } finally {
      await session.endSession();
    }
    assert.equal(await actualDb.collection("pedidos").countDocuments({}), 0,
      "order insert must be rolled back with the failed claim");
    const stored = await actualDb.collection("gruk_offline_inbox").findOne({ eventId: event.eventId });
    assert.equal(stored.status, "PENDIENTE");
    assert.equal(stored.eventHash, digest(event));
  } finally {
    try { await actualDb.dropDatabase(); } finally { await client.close(); }
  }
});
