"use strict";
// Durable inbox for OFFLINE events. Recording an event is NOT posting a sale/payment.
// A later domain processor must authorize, reconcile and apply it atomically.
const { validateBatch } = require("./offlineBatch.contract");
function collectionFor(db) {
  if (!db || typeof db.collection !== "function") throw new TypeError("OFFLINE_DATABASE_REQUIRED");
  return db.collection("gruk_offline_inbox");
}
async function ensureInboxIndexes(db) {
  const collection = collectionFor(db);
  await collection.createIndex({ empresaId: 1, sedeId: 1, eventId: 1 }, { unique: true, name: "uniq_offline_event_per_tenant" });
  await collection.createIndex({ empresaId: 1, sedeId: 1, status: 1, receivedAt: 1 }, { name: "offline_pending_by_tenant" });
}
async function acceptOfflineBatch({ db, authenticatedContext, events }) {
  const validated = validateBatch(events, authenticatedContext);
  const inbox = collectionFor(db);
  const result = [];
  for (const event of validated) {
    const key = { empresaId: authenticatedContext.empresaId, sedeId: authenticatedContext.sedeId, eventId: event.eventId };
    // Persist exact payload once; $setOnInsert does not change a previously received operation.
    // The unique index is mandatory to prevent cross-process/retry duplication.
    try {
      const response = await inbox.updateOne(key, { $setOnInsert: {
        ...event,
        empresaId: key.empresaId,
        sedeId: key.sedeId,
        actorId: authenticatedContext.actorId,
        receivedAt: new Date(),
        status: "PENDIENTE"
      } }, { upsert: true });
      result.push({ eventId: event.eventId, status: response.upsertedCount === 1 ? "RECIBIDO" : "YA_RECIBIDO" });
    } catch (error) {
      if (error && error.code === 11000) {
        result.push({ eventId: event.eventId, status: "YA_RECIBIDO" });
        continue;
      }
      throw error;
    }
  }
  return result;
}
module.exports = { ensureInboxIndexes, acceptOfflineBatch };
