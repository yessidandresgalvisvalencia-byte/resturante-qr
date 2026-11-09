"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { MongoClient } = require("mongodb");
const { digest } = require("../../core/offline/offlineInbox.service");
const { processPendingOfflinePedido } = require("../../core/offline/offlinePedidoAtomic.service");

const uri = process.env.GRUK_TEST_MONGO_URI;
const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const companyA = "507f1f77bcf86cd799439011";
const companyB = "507f191e810c19729de860ea";
const context = { empresaId: companyA, sedeId: "sede-A", actorId: "actor-A" };
const event = {
  ...context, eventId, tipo: "PEDIDO_REGISTRADO",
  deviceId: "device-A", occurredAt: "2026-11-09T00:00:00.000Z",
  schemaVersion: 1, payload: {}
};

test("Mongo replica-set transaction rejects a foreign or absent offline inbox event without creating an order", {
  skip: !uri && "GRUK_TEST_MONGO_URI not configured"
}, async () => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  const dbName = "gruk_offline_scope_" + randomBytes(8).toString("hex");
  await client.connect();
  const db = client.db(dbName);
  try {
    // A matching eventId under another tenant must not authorize a local order.
    await db.collection("gruk_offline_inbox").insertOne({
      ...event, empresaId: companyB, eventHash: digest({ ...event, empresaId: companyB }),
      status: "PENDIENTE"
    });
    const session = client.startSession();
    try {
      await assert.rejects(
        processPendingOfflinePedido({ db, session, event, context }),
        error => error?.code === "OFFLINE_EVENT_NOT_FOUND"
      );
    } finally {
      await session.endSession();
    }
    assert.equal(await db.collection("pedidos").countDocuments({}), 0);
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({ status: "PENDIENTE" }), 1);

    // Even a matching tenant cannot process an event that was never accepted.
    const otherEvent = { ...event, eventId: "01ARZ3NDEKTSV4RRFFQ69G5FAW" };
    const second = client.startSession();
    try {
      await assert.rejects(
        processPendingOfflinePedido({ db, session: second, event: otherEvent, context }),
        error => error?.code === "OFFLINE_EVENT_NOT_FOUND"
      );
    } finally {
      await second.endSession();
    }
    assert.equal(await db.collection("pedidos").countDocuments({}), 0);
  } finally {
    try { await db.dropDatabase(); } finally { await client.close(); }
  }
});
