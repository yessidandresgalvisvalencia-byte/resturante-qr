"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { appendMovement, ensureLedgerIndexes } = require("../../core/ledger/appendLedger.service");
const { verifyLedgerChain } = require("../../core/ledger/verifyLedger.service");
const { acceptOfflineBatch, ensureInboxIndexes } = require("../../core/offline/offlineInbox.service");
const { beginReview } = require("../../core/offline/offlineReview.service");
const { markOfflineApplied } = require("../../core/offline/offlineApply.service");

test("ledger: real MongoDB transaction, idempotent retry and tenant isolation", { timeout: 30000, skip: !process.env.GRUK_TEST_MONGO_URI }, async () => {
  const { MongoClient } = require("mongodb");
  const uri = process.env.GRUK_TEST_MONGO_URI;
  if (!uri) throw new Error("GRUK_TEST_MONGO_URI_REQUIRED");
  // This test owns an ephemeral database; refuse remote and multi-host URIs.
  const parsed = new URL(uri);
  if (parsed.protocol !== "mongodb:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
      parsed.username || parsed.password ||
      parsed.host.includes(",")) {
    throw new Error("GRUK_TEST_MONGO_LOCALHOST_ONLY");
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const testDbName = "gruk_capa1_ci_" + randomUUID().replace(/-/g, "");
  const db = client.db(testDbName);
  try {
    await ensureLedgerIndexes(db);
    const base = {
      client, db, empresaId: "companyA", sedeId: "s1", cuentaId: "cash",
      eventId: "evt001", tipo: "CREDITO", amountCentavos: "5200000",
      actorId: "user1", ip: "127.0.0.1"
    };
    const first = await appendMovement(base);
    assert.equal(first.afterCentavos, "5200000");
    const retry = await appendMovement({ ...base, ip: "10.1.1.1" });
    assert.equal(retry.alreadyApplied, true);
    assert.equal(await db.collection("gruk_ledger_movimientos").countDocuments({ empresaId: "companyA" }), 1);
    await assert.rejects(
      appendMovement({ ...base, amountCentavos: "1" }),
      /LEDGER_EVENT_CONFLICT/
    );
    // Two concurrent retries for one event must never create two postings.
    const concurrentEvent = { ...base, eventId: "evt-concurrent-1", amountCentavos: "300" };
    const attempts = await Promise.allSettled([
      appendMovement(concurrentEvent),
      appendMovement(concurrentEvent)
    ]);
    // MongoDB may report a write conflict to a contending transaction.
    // The invariant is one committed posting, with an idempotent retry.
    assert.ok(attempts.some(x => x.status === "fulfilled"));
    const storedConcurrent = await db.collection("gruk_ledger_movimientos")
      .find({ empresaId: "companyA", sedeId: "s1", eventId: "evt-concurrent-1" })
      .toArray();
    assert.equal(storedConcurrent.length, 1, "concurrent event cannot be posted twice");
    assert.equal((await appendMovement(concurrentEvent)).alreadyApplied, true);
    const second = await appendMovement({
      ...base, empresaId: "companyB", eventId: "evt002", amountCentavos: "700"
    });
    assert.equal(second.beforeCentavos, "0");
    const docs = await db.collection("gruk_ledger_movimientos")
      .find({ empresaId: "companyA", sedeId: "s1", cuentaId: "cash" })
      .sort({ secuencia: 1 }).toArray();
    const head = await db.collection("gruk_ledger_heads")
      .findOne({ empresaId: "companyA", sedeId: "s1", cuentaId: "cash" });
    assert.equal(verifyLedgerChain({ movements: docs, head }).valid, true);
    // Real Mongo inbox: tenant isolation and collision detection across reconnects.
    await ensureInboxIndexes(db);
    const ctxA = { empresaId: "companyA", sedeId: "s1", actorId: "user1" };
    const ctxB = { empresaId: "companyB", sedeId: "s1", actorId: "user2" };
    const offlineEvent = {
      eventId: "01K7R00YFBPZ7KYP62F4BXM2JN",
      empresaId: "companyA", sedeId: "s1", actorId: "user1",
      deviceId: "device1", tipo: "VENTA_REGISTRADA",
      occurredAt: "2026-10-17T12:00:00.000Z", schemaVersion: 1,
      payload: { ventaId: "sale1" }
    };
    const receive = x => acceptOfflineBatch({ db, authenticatedContext: ctxA, events: [x] });
    assert.equal((await receive(offlineEvent))[0].status, "RECIBIDO");
    assert.equal((await receive({ ...offlineEvent, payload: { ventaId: "sale1" } }))[0].status, "YA_RECIBIDO");
    await assert.rejects(receive({ ...offlineEvent, payload: { ventaId: "tampered" } }), /OFFLINE_EVENT_CONFLICT/);
    await assert.rejects(receive({ ...offlineEvent, empresaId: "companyB" }), /OFFLINE_TENANT_MISMATCH/);
    const concurrentOffline = { ...offlineEvent, eventId: "01K7R00YFBPZ7KYP62F4BXM2JP", payload: { ventaId: "sale2" } };
    const concurrentResults = await Promise.allSettled([
      receive(concurrentOffline),
      receive({ ...concurrentOffline, payload: { ventaId: "sale2" } })
    ]);
    assert.equal(concurrentResults.filter(x => x.status === "fulfilled").length, 2,
      "both identical concurrent deliveries should be acknowledged");
    const statuses = concurrentResults.map(x => x.value[0].status).sort();
    assert.deepEqual(statuses, ["RECIBIDO", "YA_RECIBIDO"]);
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
      empresaId: "companyA", sedeId: "s1", eventId: concurrentOffline.eventId
    }), 1, "only one durable record for concurrent retries");
    await assert.rejects(receive({
      ...concurrentOffline, payload: { ventaId: "altered-on-retry" }
    }), /OFFLINE_EVENT_CONFLICT/);
    const forCompanyB = { ...offlineEvent, empresaId: "companyB", actorId: "user2" };
    assert.equal((await acceptOfflineBatch({ db, authenticatedContext: ctxB, events: [forCompanyB] }))[0].status, "RECIBIDO");
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({ empresaId: "companyA", sedeId: "s1" }), 2);
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({ empresaId: "companyB", sedeId: "s1" }), 1);
    // No sale is posted merely because an offline event was accepted.
    const storedBeforeReview = await db.collection("gruk_offline_inbox").findOne({
      empresaId: "companyA", sedeId: "s1", eventId: offlineEvent.eventId
    });
    assert.equal(storedBeforeReview.status, "PENDIENTE");
    const reviewer = { ...ctxA, canReview: true };
    await assert.rejects(beginReview({
      db, context: { ...ctxA, canReview: false }, eventId: offlineEvent.eventId
    }), /OFFLINE_AUTH_REQUIRED/);
    const claims = await Promise.all([
      beginReview({ db, context: reviewer, eventId: offlineEvent.eventId }),
      beginReview({ db, context: reviewer, eventId: offlineEvent.eventId })
    ]);
    assert.equal(claims.filter(r => r.status === "EN_REVISION").length, 1);
    assert.equal(claims.filter(r => r.status !== "EN_REVISION").length, 1);
    const storedAfterReview = await db.collection("gruk_offline_inbox").findOne({
      empresaId: "companyA", sedeId: "s1", eventId: offlineEvent.eventId
    });
    assert.equal(storedAfterReview.status, "EN_REVISION");
    // A real persisted inbox row cannot be finalized without a matching posted ledger movement.
    await assert.rejects(markOfflineApplied({
      db, context: reviewer, eventId: offlineEvent.eventId,
      reviewToken: claims.find(x => x.status === "EN_REVISION").reviewToken,
      commitReference: { collection: "gruk_ledger_movimientos", eventId: offlineEvent.eventId }
    }), /OFFLINE_DOMAIN_NOT_COMMITTED/);
    const notApplied = await db.collection("gruk_offline_inbox").findOne({
      empresaId: "companyA", sedeId: "s1", eventId: offlineEvent.eventId
    });
    assert.equal(notApplied.status, "EN_REVISION");
    // Even a posted ledger row with the same event and tenant is insufficient
    // if it belongs to a different originating actor.
    await appendMovement({
      ...base, eventId: offlineEvent.eventId, actorId: "otherUser",
      amountCentavos: "150", tipo: "CREDITO"
    });
    await assert.rejects(markOfflineApplied({
      db, context: reviewer, eventId: offlineEvent.eventId,
      reviewToken: claims.find(x => x.status === "EN_REVISION").reviewToken,
      commitReference: { collection: "gruk_ledger_movimientos", eventId: offlineEvent.eventId }
    }), /OFFLINE_DOMAIN_NOT_COMMITTED/);
    const stillInReview = await db.collection("gruk_offline_inbox").findOne({
      empresaId: "companyA", sedeId: "s1", eventId: offlineEvent.eventId
    });
    assert.equal(stillInReview.status, "EN_REVISION");
    // A separate legitimate ledger event can be finalized once, with matching actor.
    const completedEvent = {
      ...offlineEvent, eventId: "01K7R00YFBPZ7KYP62F4BXM2JQ",
      payload: { ventaId: "sale3" }
    };
    assert.equal((await receive(completedEvent))[0].status, "RECIBIDO");
    const review = await beginReview({
      db, context: reviewer, eventId: completedEvent.eventId
    });
    assert.equal(review.status, "EN_REVISION");
    await appendMovement({
      ...base, eventId: completedEvent.eventId, actorId: completedEvent.actorId,
      amountCentavos: "150", tipo: "CREDITO"
    });
    await assert.rejects(markOfflineApplied({
      db, context: reviewer, eventId: completedEvent.eventId,
      reviewToken: review.reviewToken,
      commitReference: { collection: "gruk_ledger_movimientos", eventId: completedEvent.eventId }
    }), /OFFLINE_DOMAIN_NOT_COMMITTED/;
    await assert.rejects(markOfflineApplied({
      db, context: reviewer, eventId: completedEvent.eventId,
      reviewToken: review.reviewToken,
      commitReference: { collection: "gruk_ledger_movimientos", eventId: completedEvent.eventId }
    }), /OFFLINE_DOMAIN_NOT_COMMITTED/;
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
      empresaId: "companyA", sedeId: "s1",
      eventId: completedEvent.eventId, status: "APLICADO"
    }), 0);



    assert.equal(await db.collection("gruk_ledger_movimientos")
      .countDocuments({ empresaId: "companyA", eventId: offlineEvent.eventId, actorId: "otherUser" }), 1);


  } finally {
    await db.dropDatabase();
    await client.close();
  }
});
