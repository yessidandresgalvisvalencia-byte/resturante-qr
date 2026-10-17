"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const { acceptOfflineBatch, ensureInboxIndexes } = require("../../core/offline/offlineInbox.service");
const { readOfflineStatuses } = require("../../core/offline/offlineStatus.service");

// Never run this integration test against the production MONGO_URI.
const uri = process.env.GRUK_TEST_MONGO_URI;
const isolated = typeof uri === "string" && /\/gruk_[a-z0-9_-]*test(?:\?|$)/i.test(uri);
test("MongoDB real: 20 offline events survive retries, status isolation and content conflicts", { skip: !isolated && "Requires explicit isolated GRUK_TEST_MONGO_URI ending in /gruk_*test" }, async () => {
  const connection = mongoose.createConnection(uri);
  await connection.asPromise();
  const db = connection.db;
  const empresaId = "test_" + randomUUID().replace(/-/g, "");
  const sedeId = "sedeTest", actorId = "cajeroTest";
  const context = { empresaId, sedeId, actorId };
  const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const ids = [...chars.slice(0, 20)].map(c => "01ARZ3NDEKTSV4RRFFQ69G5FA" + c);
  const events = ids.map((eventId, i) => ({
    eventId, ...context, deviceId: "tabletTest", tipo: "PEDIDO_REGISTRADO",
    occurredAt: "2026-10-17T12:00:00.000Z", schemaVersion: 1,
    payload: { localOrderId: "order-" + i }
  }));
  try {
    await ensureInboxIndexes(db);
    // First-arrival race: same new event on two tablets must be inserted only once.
    const raceEvent = { ...events[0], eventId: "01ARZ3NDEKTSV4RRFFQ69G5FAY" };
    const [raceA, raceB] = await Promise.all([
      acceptOfflineBatch({ db, authenticatedContext: context, events: [raceEvent] }),
      acceptOfflineBatch({ db, authenticatedContext: context, events: [raceEvent] })
    ]);
    assert.deepEqual([raceA[0].status, raceB[0].status].sort(), ["RECIBIDO", "YA_RECIBIDO"]);
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({ empresaId, sedeId, eventId: raceEvent.eventId }), 1);
    // Remove only the synthetic race fixture; subsequent assertions require exactly 20 events.
    await db.collection("gruk_offline_inbox").deleteOne({ empresaId, sedeId, eventId: raceEvent.eventId });
    const first = await acceptOfflineBatch({ db, authenticatedContext: context, events: events.slice(0, 8) });
    assert.equal(first.filter(x => x.status === "RECIBIDO").length, 8);
    const retry = await acceptOfflineBatch({ db, authenticatedContext: context, events });
    assert.equal(retry.filter(x => x.status === "RECIBIDO").length, 12);
    assert.equal(retry.filter(x => x.status === "YA_RECIBIDO").length, 8);
    // Simultaneous retries from two connections must leave one durable event per ULID.
    const [simultaneousA, simultaneousB] = await Promise.all([
      acceptOfflineBatch({ db, authenticatedContext: context, events }),
      acceptOfflineBatch({ db, authenticatedContext: context, events })
    ]);
    assert.equal(simultaneousA.length, 20);
    assert.equal(simultaneousB.length, 20);
    assert.ok([...simultaneousA, ...simultaneousB].every(r => r.status === "YA_RECIBIDO"));
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({ empresaId, sedeId }), 20);
    const final = await acceptOfflineBatch({ db, authenticatedContext: context, events });
    assert.equal(final.filter(x => x.status === "YA_RECIBIDO").length, 20);
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({ empresaId, sedeId }), 20);
    const statuses = await readOfflineStatuses({ db, context, eventIds: ids });
    assert.equal(statuses.length, 20);
    assert.ok(statuses.every(x => x.status === "PENDIENTE" && x.applied === false));
    const crossActor = await readOfflineStatuses({ db, context: { ...context, actorId: "otroActor" }, eventIds: ids });
    assert.ok(crossActor.every(x => x.status === "NO_ENCONTRADO"));
    const crossEmpresa = await readOfflineStatuses({ db, context: { ...context, empresaId: "otraEmpresa" }, eventIds: ids });
    assert.ok(crossEmpresa.every(x => x.status === "NO_ENCONTRADO" && x.applied === false));
    const crossSede = await readOfflineStatuses({ db, context: { ...context, sedeId: "otraSede" }, eventIds: ids });
    assert.ok(crossSede.every(x => x.status === "NO_ENCONTRADO" && x.applied === false));
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({ empresaId, sedeId, status: "APLICADO" }), 0);
    // Two independent companies may legitimately generate identical ULIDs.
    const secondTenant = { empresaId: empresaId + "_b", sedeId, actorId };
    const independent = { ...events[0], empresaId: secondTenant.empresaId };
    const insertedOtherTenant = await acceptOfflineBatch({ db, authenticatedContext: secondTenant, events: [independent] });
    assert.equal(insertedOtherTenant[0].status, "RECIBIDO");
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({ empresaId: { $in: [empresaId, secondTenant.empresaId] }, eventId: ids[0] }), 2);
    const originalVisible = await readOfflineStatuses({ db, context, eventIds: [ids[0]] });
    const otherVisible = await readOfflineStatuses({ db, context: secondTenant, eventIds: [ids[0]] });
    assert.equal(originalVisible[0].status, "PENDIENTE");
    assert.equal(otherVisible[0].status, "PENDIENTE");
    await assert.rejects(
      acceptOfflineBatch({ db, authenticatedContext: context, events: [{ ...events[0], payload: { localOrderId: "tampered" } }] }),
      error => error.code === "OFFLINE_EVENT_CONFLICT"
    );
  } finally {
    await db.collection("gruk_offline_inbox").deleteMany({ empresaId: { $in: [empresaId, empresaId + "_b"] }, sedeId });
    await connection.close();
  }
});
