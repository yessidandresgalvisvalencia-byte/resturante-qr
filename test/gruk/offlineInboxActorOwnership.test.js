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

test("duplicate-key race returns YA_RECIBIDO only when stored event and actor match", async () => {
  const db = { collection: () => ({
    updateOne: async () => { const error = new Error("duplicate key"); error.code = 11000; throw error; },
    findOne: async () => ({ eventHash: digest(event), actorId: context.actorId })
  }) };
  const result = await acceptOfflineBatch({ db, authenticatedContext: context, events: [event] });
  assert.equal(result[0].status, "YA_RECIBIDO");
});
test("duplicate-key race never accepts changed stored payload", async () => {
  const db = { collection: () => ({
    updateOne: async () => { const error = new Error("duplicate key"); error.code = 11000; throw error; },
    findOne: async () => ({ eventHash: digest({ ...event, payload: { pedidoId: "otro" } }), actorId: context.actorId })
  }) };
  await assert.rejects(acceptOfflineBatch({ db, authenticatedContext: context, events: [event] }),
    error => error.code === "OFFLINE_EVENT_CONFLICT");
});
test("events from a different tenant fail before database access", async () => {
  let accessed = false;
  const db = { collection: () => { accessed = true; throw new Error("DATABASE_SHOULD_NOT_BE_ACCESSED"); } };
  await assert.rejects(
    acceptOfflineBatch({ db, authenticatedContext: context, events: [{ ...event, empresaId: "empresaB" }] }),
    error => error.code === "OFFLINE_TENANT_MISMATCH"
  );
  assert.equal(accessed, false);
});
