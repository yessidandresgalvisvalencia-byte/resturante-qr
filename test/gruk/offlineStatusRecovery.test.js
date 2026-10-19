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
test("receipt without financial proof stays unapplied after reconnect", async () => {
  let query;
  const db = { collection: name => {
    assert.ok(["gruk_offline_inbox","gruk_offline_ventas","gruk_offline_caja_intenciones","gruk_ledger_movimientos"].includes(name));
    return { find: (q, options) => {
      query = q;
      assert.equal(options.projection._id, 0);
      return { toArray: async () => [
        { ...context, eventId: ids[0], status: "PENDIENTE" },
        { ...context, eventId: ids[1], status: "APLICADO" }
      ] };
    }};
  }};
  const result = await readOfflineStatuses({ db, context, eventIds: ids });
  assert.deepEqual(query, { empresaId:context.empresaId,sedeId:context.sedeId,eventId: { $in: ids } });
  assert.deepEqual(result, [
    { eventId: ids[0], status: "PENDIENTE", applied: false },
    { eventId: ids[1], status: "APLICADO", applied: false },
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

test("offline status scopes tenant, location and actor; unrelated events are never visible", async () => {
  const stored = [
    { empresaId: "empresaA", sedeId: "sedeA", actorId: "cajeroA", eventId: ids[0], status: "APLICADO" },
    { empresaId: "empresaB", sedeId: "sedeA", actorId: "cajeroA", eventId: ids[1], status: "APLICADO" },
    { empresaId: "empresaA", sedeId: "sedeB", actorId: "cajeroA", eventId: ids[1], status: "APLICADO" },
    { empresaId: "empresaA", sedeId: "sedeA", actorId: "cajeroB", eventId: ids[2], status: "APLICADO" }
  ];
  const db = { collection: () => ({ find: q => ({
    toArray: async () => stored.filter(item =>
      item.empresaId === q.empresaId &&
      item.sedeId === q.sedeId &&
      item.actorId === q.actorId &&
      q.eventId.$in.includes(item.eventId))
  }) }) };
  const result = await readOfflineStatuses({ db, context, eventIds: ids });
  assert.deepEqual(result, [
    { eventId: ids[0], status: "APLICADO", applied: false },
    { eventId: ids[1], status: "NO_ENCONTRADO", applied: false },
    { eventId: ids[2], status: "NO_ENCONTRADO", applied: false }
  ]);
});

test("offline status rejects unsafe authenticated identity values before Mongo access", async () => {
  let touched = false;
  const db = { collection: () => { touched = true; throw Error("SHOULD_NOT_QUERY"); } };
  const invalid = [
    { ...context, empresaId: { "$ne": null } },
    { ...context, sedeId: "sede.A" },
    { ...context, actorId: "actor$ne" },
    { ...context, empresaId: "x".repeat(81) }
  ];
  for (const candidate of invalid) {
    await assert.rejects(readOfflineStatuses({ db, context: candidate, eventIds: [ids[0]] }), /OFFLINE_AUTH_REQUIRED/);
  }
  assert.equal(touched, false);
});

test("status rejects malformed authenticated identity consistently", async () => {
  let touched = false;
  const db = { collection: () => { touched = true; throw Error("UNEXPECTED_DB_ACCESS"); } };
  await assert.rejects(readOfflineStatuses({
    db, context: { ...context, empresaId: "empresa.$ne" }, eventIds: [ids[0]]
  }), /OFFLINE_AUTH_REQUIRED/);
  assert.equal(touched, false);
});
