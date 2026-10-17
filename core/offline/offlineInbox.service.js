"use strict";
// Durable inbox. Acceptance is NOT sale posting, stock adjustment or payment approval.
const { createHash } = require("node:crypto");
const { validateBatch } = require("./offlineBatch.contract");
function collectionFor(db) {
  if (!db || typeof db.collection !== "function") throw new TypeError("OFFLINE_DATABASE_REQUIRED");
  return db.collection("gruk_offline_inbox");
}
function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stableJson(value[k])).join(",") + "}";
  }
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError("OFFLINE_UNSERIALIZABLE_PAYLOAD");
  return json;
}
function digest(event) {
  return createHash("sha256").update(stableJson(event), "utf8").digest("hex");
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
    const eventHash = digest(event);
    let inserted = false;
    try {
      const response = await inbox.updateOne(key, { $setOnInsert: {
        ...event, empresaId: key.empresaId, sedeId: key.sedeId,
        actorId: authenticatedContext.actorId, eventHash,
        receivedAt: new Date(), status: "PENDIENTE"
      } }, { upsert: true });
      inserted = response.upsertedCount === 1;
    } catch (error) {
      if (!error || error.code !== 11000) throw error;
    }
    if (!inserted) {
      // The same ID with changed contents is an integrity conflict, never a harmless retry.
      const previous = await inbox.findOne(key, { projection: { eventHash: 1, actorId: 1, _id: 0 } });
      if (!previous || previous.eventHash !== eventHash || previous.actorId !== authenticatedContext.actorId) {
        const conflict = new Error("OFFLINE_EVENT_CONFLICT");
        conflict.code = "OFFLINE_EVENT_CONFLICT";
        throw conflict;
      }
    }
    result.push({ eventId: event.eventId, status: inserted ? "RECIBIDO" : "YA_RECIBIDO" });
  }
  return result;
}
module.exports = { ensureInboxIndexes, acceptOfflineBatch, digest };
