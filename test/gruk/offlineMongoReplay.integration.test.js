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
    const first = await acceptOfflineBatch({ db, authenticatedContext: context, events: events.slice(0, 8) });
    assert.equal(first.filter(x => x.status === "RECIBIDO").length, 8);
    const retry = await acceptOfflineBatch({ db, authenticatedContext: context, events });
    assert.equal(retry.filter(x => x.status === "RECIBIDO").length, 12);
    assert.equal(retry.filter(x => x.status === "YA_RECIBIDO").length, 8);
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
    await assert.rejects(
      acceptOfflineBatch({ db, authenticatedContext: context, events: [{ ...events[0], payload: { localOrderId: "tampered" } }] }),
      error => error.code === "OFFLINE_EVENT_CONFLICT"
    );
  } finally {
    await db.collection("gruk_offline_inbox").deleteMany({ empresaId, sedeId });
    await connection.close();
  }
});
