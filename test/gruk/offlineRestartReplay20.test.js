"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { acceptOfflineBatch } = require("../../core/offline/offlineInbox.service");
const ctx = { empresaId: "empresaA", sedeId: "sedeA", actorId: "cajeroA" };
const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const events = Array.from({ length: 20 }, (_, i) => ({
  eventId: "01ARZ3NDEKTSV4RRFFQ69G5FA" + chars[i],
  ...ctx, deviceId: "tabletA", tipo: "PEDIDO_REGISTRADO",
  occurredAt: "2026-10-17T12:00:00.000Z", schemaVersion: 1,
  payload: { pedidoLocal: "pedido-" + i }
}));
function durableFakeInbox() {
  const saved = new Map();
  const collection = {
    updateOne: async (key, update) => {
      const id = [key.empresaId, key.sedeId, key.eventId].join("/");
      if (saved.has(id)) return { upsertedCount: 0 };
      saved.set(id, structuredClone(update.$setOnInsert));
      return { upsertedCount: 1 };
    },
    findOne: async key => {
      const data = saved.get([key.empresaId, key.sedeId, key.eventId].join("/"));
      return data ? { eventHash: data.eventHash, actorId: data.actorId, empresaId:data.empresaId,sedeId:data.sedeId,eventId:data.eventId } : null;
    }
  };
  return { db: { collection: () => collection, client: { startSession: () => ({
    withTransaction: async fn => fn(), endSession: async () => {}
  }) } }, saved };
}
test("20 offline events survive simulated tablet restart and repeated batch delivery without duplicates", async () => {
  const { db, saved } = durableFakeInbox();
  // The same persisted browser outbox is restored after the application restarts.
  const first = await acceptOfflineBatch({ db, authenticatedContext: ctx, events: events.slice(0, 8) });
  assert.equal(first.filter(e => e.status === "RECIBIDO").length, 8);
  const restoredOutbox = structuredClone(events);
  const second = await acceptOfflineBatch({ db, authenticatedContext: ctx, events: restoredOutbox });
  assert.equal(second.filter(e => e.status === "RECIBIDO").length, 12);
  assert.equal(second.filter(e => e.status === "YA_RECIBIDO").length, 8);
  assert.equal(saved.size, 20);
  const repeated = await acceptOfflineBatch({ db, authenticatedContext: ctx, events: restoredOutbox });
  assert.equal(repeated.filter(e => e.status === "YA_RECIBIDO").length, 20);
  assert.equal(saved.size, 20);
});
test("offline inbox rejects changed event on reconnect and retains original record", async () => {
  const { db, saved } = durableFakeInbox();
  await acceptOfflineBatch({ db, authenticatedContext: ctx, events: [events[0]] });
  await assert.rejects(
    acceptOfflineBatch({ db, authenticatedContext: ctx, events: [{ ...events[0], payload: { pedidoLocal: "alterado" } }] }),
    error => error.code === "OFFLINE_EVENT_CONFLICT"
  );
  assert.equal(saved.size, 1);
  assert.equal([...saved.values()][0].payload.pedidoLocal, "pedido-0");
});
