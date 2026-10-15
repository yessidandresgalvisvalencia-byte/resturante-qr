"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { MongoClient, ObjectId } = require("mongodb");

test("Outbox: un evento CLAIMED con lease vencido puede recuperarse sin duplicar su registro", async (t) => {
  const uri = process.env.TEST_MONGO_URI;
  if (!uri) { t.skip("Requiere TEST_MONGO_URI de replica set"); return; }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db("gruk_test_outbox_recovery");
  const events = db.collection("events");
  const eventId = "VENTA_COMPLETADA:" + new ObjectId().toHexString();
  const past = new Date(Date.now() - 120000);
  try {
    await events.createIndex({ eventId: 1 }, { unique: true });
    await events.insertOne({
      eventId, status: "CLAIMED", claimedBy: "worker-caido",
      claimToken: "lease-expirado", leaseUntil: past,
      attempts: 1, nextAttemptAt: past, createdAt: past
    });
    const now = new Date();
    const claimed = await events.findOneAndUpdate(
      {
        nextAttemptAt: { $lte: now },
        $or: [
          { status: "PENDING" },
          { status: "CLAIMED", leaseUntil: { $lte: now } }
        ]
      },
      {
        $set: {
          status: "CLAIMED", claimedBy: "worker-recuperado",
          claimToken: "lease-nuevo", leaseUntil: new Date(now.getTime() + 60000)
        },
        $inc: { attempts: 1 }
      },
      { sort: { createdAt: 1 }, returnDocument: "after" }
    );
    assert.equal(claimed?.eventId, eventId);
    assert.equal(claimed?.claimedBy, "worker-recuperado");
    assert.equal(claimed?.attempts, 2);

    const oldAck = await events.updateOne(
      { eventId, status: "CLAIMED", claimedBy: "worker-caido", claimToken: "lease-expirado" },
      { $set: { status: "DONE" } }
    );
    assert.equal(oldAck.modifiedCount, 0, "Un trabajador obsoleto no debe confirmar");
    const newAck = await events.updateOne(
      { eventId, status: "CLAIMED", claimedBy: "worker-recuperado", claimToken: "lease-nuevo" },
      { $set: { status: "DONE" } }
    );
    assert.equal(newAck.modifiedCount, 1);
    assert.equal(await events.countDocuments({ eventId }), 1);
    await assert.rejects(events.insertOne({ eventId, status: "PENDING" }), error => error.code === 11000);
  } finally {
    await db.dropDatabase();
    await client.close();
  }
});
