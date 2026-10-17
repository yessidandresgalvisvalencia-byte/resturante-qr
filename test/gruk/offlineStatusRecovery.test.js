"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readOfflineStatuses } = require("../../core/offline/offlineStatus.service");
const context = { empresaId: "empresaA", sedeId: "sedeA", actorId: "cajeroA" };
const ids = [
  "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  "01ARZ3NDEKTSV4RRFFQ69G5FAX"
];
test("receipt without posting stays unapplied after reconnect; only APLICADO is applied", async () => {
  let query;
  const db = { collection: name => {
    assert.equal(name, "gruk_offline_inbox");
    return { find: (q, options) => {
      query = q;
      assert.deepEqual(options.projection, { _id: 0, eventId: 1, status: 1 });
      return { toArray: async () => [
        { eventId: ids[0], status: "PENDIENTE" },
        { eventId: ids[1], status: "APLICADO" }
      ] };
    }};
  }};
  const result = await readOfflineStatuses({ db, context, eventIds: ids });
  assert.deepEqual(query, { ...context, eventId: { $in: ids } });
  assert.deepEqual(result, [
    { eventId: ids[0], status: "PENDIENTE", applied: false },
    { eventId: ids[1], status: "APLICADO", applied: true },
    { eventId: ids[2], status: "NO_ENCONTRADO", applied: false }
  ]);
});
test("status queries reject duplicate IDs and tenantless contexts before querying storage", async () => {
  let accessed = false;
  const db = { collection: () => { accessed = true; throw new Error("UNEXPECTED_DB_ACCESS"); } };
  await assert.rejects(readOfflineStatuses({ db, context, eventIds: [ids[0], ids[0]] }), /OFFLINE_INVALID_IDS/);
  await assert.rejects(readOfflineStatuses({ db, context: { empresaId: "", sedeId: "sedeA", actorId: "cajeroA" }, eventIds: [ids[0]] }), /OFFLINE_AUTH_REQUIRED/);
  assert.equal(accessed, false);
});
