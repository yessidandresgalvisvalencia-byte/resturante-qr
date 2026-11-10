"use strict";
// P0 #04/#05: positive Mongo replica-set integration of the atomic offline claim.
// This is an internal service test, NOT an HTTP/E2E or payment/stock/ledger test.
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { MongoClient, ObjectId } = require("mongodb");
const { digest } = require("../../core/offline/offlineInbox.service");
const { processPendingOfflinePedido } = require("../../core/offline/offlinePedidoAtomic.service");

const uri = process.env.GRUK_TEST_MONGO_URI;
test("Mongo transaction claims a valid offline order exactly once and preserves tenant isolation on retry", {
  skip: !uri && "GRUK_TEST_MONGO_URI not configured"
}, async () => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  const dbName = "gruk_offline_positive_" + randomBytes(8).toString("hex");
  await client.connect();
  const db = client.db(dbName);
  const empresaId = new ObjectId().toHexString();
  const menuId = new ObjectId();
  const productId = new ObjectId();
  const context = { empresaId, sedeId: "sede-A", actorId: "actor-A" };
  const event = {
    ...context, eventId: "01ARZ3NDEKTSV4RRFFQ69G5FAY",
    tipo: "PEDIDO_REGISTRADO", deviceId: "device-A",
    occurredAt: "2026-11-09T00:00:00.000Z", schemaVersion: 1,
    payload: { restaurantId: "rest-A", menuItemId: menuId.toHexString(), mesa: 1, cantidad: 2 }
  };
  // Match the model API used by the preparation service while keeping the
  // actual lookups and order/inbox writes on a MongoDB replica-set transaction.
  const model = name => ({
    findOne(filter) {
      // Mongoose casts schema ObjectId paths; the minimal Mongo adapter must do so too.
      const castFilter = { ...filter };
      if (typeof castFilter._id === "string" && ObjectId.isValid(castFilter._id)) {
        castFilter._id = new ObjectId(castFilter._id);
      }
      return { session: session => db.collection(name).findOne(castFilter, { session }) };
    }
  });
  db.models = { Menu: model("menus"), ProductoServicio: model("productoservicios") };
  try {
    await db.collection("restaurantes").insertOne({ restaurantId: "rest-A", empresaId });
    await db.collection("productoservicios").insertOne({
      _id: productId, empresaId, tipo: "producto", activo: true
    });
    await db.collection("menus").insertOne({
      _id: menuId, restaurantId: "rest-A", disponible: true,
      productoServicioId: productId, precio: 12500
    });
    await db.collection("gruk_offline_inbox").insertOne({
      ...event, eventHash: digest(event), status: "PENDIENTE"
    });
    const session = client.startSession();
    try {
      const first = await processPendingOfflinePedido({ db, session, event, context });
      assert.deepEqual(first, {
        eventId: event.eventId, status: "EN_REVISION", created: true,
        paymentPosted: false, inventoryPosted: false, ledgerPosted: false
      });
      const retry = await processPendingOfflinePedido({ db, session, event, context });
      assert.deepEqual(retry, { eventId: event.eventId, status: "EN_REVISION", created: false });
    } finally {
      await session.endSession();
    }
    const orders = await db.collection("pedidos").find({ offlineEventId: event.eventId }).toArray();
    assert.equal(orders.length, 1);
    assert.equal(orders[0].empresaId.toHexString(), empresaId);
    assert.equal(orders[0].sedeId, context.sedeId);
    assert.equal(orders[0].precio, 25000);
    assert.equal(orders[0].estadoPago, "pendiente");
    const inbox = await db.collection("gruk_offline_inbox").findOne({ eventId: event.eventId });
    assert.equal(inbox.status, "EN_REVISION");
    assert.equal(inbox.reviewActorId, context.actorId);
    assert.equal(inbox.eventHash, digest(event));
    assert.equal(await db.collection("pedidos").countDocuments({}), 1);
  } finally {
    try { await db.dropDatabase(); } finally { await client.close(); }
  }
});
