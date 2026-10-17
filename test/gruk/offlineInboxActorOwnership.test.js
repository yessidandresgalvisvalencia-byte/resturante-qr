"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { acceptOfflineBatch, digest } = require("../../core/offline/offlineInbox.service");
const context = { empresaId: "empresaA", sedeId: "sedeA", actorId: "cajeroA" };
const event = {
  eventId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  empresaId: context.empresaId, sedeId: context.sedeId, actorId: context.actorId,
  deviceId: "tabletA", tipo: "PEDIDO_REGISTRADO",
  occurredAt: "2026-10-17T12:00:00.000Z", schemaVersion: 1, payload: { pedidoId: "pedidoA" }
};
test("offline inbox rejects a replay when stored actor ownership differs, even with matching digest", async () => {
  const collection = {
    updateOne: async () => ({ upsertedCount: 0 }),
    findOne: async () => ({ eventHash: digest(event), actorId: "otroCajero" })
  };
  const db = { collection: name => {
    assert.equal(name, "gruk_offline_inbox");
    return collection;
  }};
  await assert.rejects(
    acceptOfflineBatch({ db, authenticatedContext: context, events: [event] }),
    error => error.code === "OFFLINE_EVENT_CONFLICT"
  );
});
test("offline inbox still accepts an exact replay by original actor", async () => {
  const collection = {
    updateOne: async () => ({ upsertedCount: 0 }),
    findOne: async () => ({ eventHash: digest(event), actorId: context.actorId })
  };
  const result = await acceptOfflineBatch({ db: { collection: () => collection }, authenticatedContext: context, events: [event] });
  assert.deepEqual(result, [{ eventId: event.eventId, status: "YA_RECIBIDO" }]);
});
