"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const { acceptOfflineBatch, ensureInboxIndexes } = require("../../core/offline/offlineInbox.service");
const { readOfflineStatuses } = require("../../core/offline/offlineStatus.service");
const { markOfflineApplied } = require("../../core/offline/offlineApply.service");

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
    // Conflicting first arrivals with the same ULID: only one payload survives.
    const conflictEvent = { ...events[0], eventId: "01ARZ3NDEKTSV4RRFFQ69G5FAZ" };
    const modifiedEvent = { ...conflictEvent, payload: { localOrderId: "different-content" } };
    const conflictResults = await Promise.allSettled([
      acceptOfflineBatch({ db, authenticatedContext: context, events: [conflictEvent] }),
      acceptOfflineBatch({ db, authenticatedContext: context, events: [modifiedEvent] })
    ]);
    assert.equal(conflictResults.filter(x => x.status === "fulfilled").length, 1);
    assert.equal(conflictResults.filter(x => x.status === "rejected" && x.reason.code === "OFFLINE_EVENT_CONFLICT").length, 1);
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({ empresaId, sedeId, eventId: conflictEvent.eventId }), 1);
    await db.collection("gruk_offline_inbox").deleteOne({ empresaId, sedeId, eventId: conflictEvent.eventId });
    // Existing conflict at the end of a batch must not partially write earlier events.
    const existingConflict = { ...events[0], eventId:"01ARZ3NDEKTSV4RRFFQ69G5FB4" };
    const freshBeforeConflict = { ...events[1], eventId:"01ARZ3NDEKTSV4RRFFQ69G5FB5" };
    await acceptOfflineBatch({db,authenticatedContext:context,events:[existingConflict]});
    await assert.rejects(
      acceptOfflineBatch({db,authenticatedContext:context,events:[
        freshBeforeConflict,
        {...existingConflict,payload:{localOrderId:"changed-existing-order"}}
      ]}),
      error => error.code === "OFFLINE_EVENT_CONFLICT"
    );
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
      empresaId,sedeId,eventId:freshBeforeConflict.eventId
    }),0);
    await db.collection("gruk_offline_inbox").deleteOne({
      empresaId,sedeId,eventId:existingConflict.eventId
    });
    // Inject failure on the second Mongo write within a real replica-set transaction.
    // The first write must roll back, not leave a half-received offline batch.
    const rollbackFirst = {...events[0], eventId:"01ARZ3NDEKTSV4RRFFQ69G5FB6"};
    const rollbackSecond = {...events[1], eventId:"01ARZ3NDEKTSV4RRFFQ69G5FB7"};
    let transactionWrites = 0;
    const failingDb = {
      client: db.client,
      collection(name) {
        const target = db.collection(name);
        if (name !== "gruk_offline_inbox") return target;
        return {
          findOne: (...args) => target.findOne(...args),
          async updateOne(...args) {
            transactionWrites++;
            if (transactionWrites === 2) throw new Error("SIMULATED_SECOND_WRITE_FAILURE");
            return target.updateOne(...args);
          }
        };
      }
    };
    await assert.rejects(
      acceptOfflineBatch({db:failingDb,authenticatedContext:context,events:[rollbackFirst,rollbackSecond]}),
      /SIMULATED_SECOND_WRITE_FAILURE/
    );
    assert.equal(transactionWrites,2);
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
      empresaId,sedeId,eventId:{$in:[rollbackFirst.eventId,rollbackSecond.eventId]}
    }),0);
    // Two different tablets send distinct orders concurrently; neither is lost.
    const tabletOne = { ...events[0], eventId: "01ARZ3NDEKTSV4RRFFQ69G5FB0", deviceId: "tabletOne" };
    const tabletTwo = { ...events[1], eventId: "01ARZ3NDEKTSV4RRFFQ69G5FB1", deviceId: "tabletTwo" };
    const [tabletResultOne, tabletResultTwo] = await Promise.all([
      acceptOfflineBatch({ db, authenticatedContext: context, events: [tabletOne] }),
      acceptOfflineBatch({ db, authenticatedContext: context, events: [tabletTwo] })
    ]);
    assert.equal(tabletResultOne[0].status, "RECIBIDO");
    assert.equal(tabletResultTwo[0].status, "RECIBIDO");
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
      empresaId, sedeId, eventId: { $in: [tabletOne.eventId, tabletTwo.eventId] }
    }), 2);
    await db.collection("gruk_offline_inbox").deleteMany({
      empresaId, sedeId, eventId: { $in: [tabletOne.eventId, tabletTwo.eventId] }
    });
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
    // Even when the event hash matches, a different authenticated actor cannot claim it.
    const otherActor = { ...context, actorId: "otroActor" };
    const actorReplay = { ...events[0], actorId: otherActor.actorId };
    await assert.rejects(
      acceptOfflineBatch({ db, authenticatedContext: otherActor, events: [actorReplay] }),
      error => error.code === "OFFLINE_EVENT_CONFLICT"
    );
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({ empresaId, sedeId, eventId: ids[0] }), 1);
    assert.equal((await db.collection("gruk_offline_inbox").findOne({ empresaId, sedeId, eventId: ids[0] })).actorId, actorId);
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
    // Applying an offline event requires a persisted, tenant-scoped ledger record.
    const reviewToken = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const proofEventId = "01ARZ3NDEKTSV4RRFFQ69G5FB2";
    await db.collection("gruk_offline_inbox").insertOne({
      empresaId, sedeId, actorId, eventId: proofEventId,
      status: "EN_REVISION", reviewToken
    });
    const review = { ...context, canReview: true };
    const commitReference = { collection: "gruk_ledger_movimientos", eventId: proofEventId };
    try {
      await assert.rejects(markOfflineApplied({ db, context: review, eventId: proofEventId, reviewToken, commitReference }));
      assert.equal((await db.collection("gruk_offline_inbox").findOne({empresaId,sedeId,eventId:proofEventId})).status, "EN_REVISION");
      // A stale reviewer token may never finalize an event claimed by another reviewer.
      const staleReview = await markOfflineApplied({
        db, context:review, eventId:proofEventId,
        reviewToken:"bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
        commitReference
      });
      assert.equal(staleReview.status, "NO_RECLAMADO");
      assert.equal((await db.collection("gruk_offline_inbox").findOne({
        empresaId,sedeId,eventId:proofEventId
      })).status,"EN_REVISION");
      // An unrelated tenant's ledger entry is never proof of this event.
      await db.collection("gruk_ledger_movimientos").insertOne({
        empresaId: empresaId + "_b", sedeId, actorId, eventId: proofEventId, deletedAt: null
      });
      try {
        await assert.rejects(markOfflineApplied({ db, context: review, eventId: proofEventId, reviewToken, commitReference }));
        assert.equal((await db.collection("gruk_offline_inbox").findOne({empresaId,sedeId,eventId:proofEventId})).status, "EN_REVISION");
      } finally {
        await db.collection("gruk_ledger_movimientos").deleteMany({empresaId:empresaId+"_b",sedeId,eventId:proofEventId});
      }
      // Same tenant but a different actor cannot supply the commit proof.
      await db.collection("gruk_ledger_movimientos").insertOne({
        empresaId, sedeId, actorId: "otroCajero", eventId: proofEventId, deletedAt: null
      });
      try {
        await assert.rejects(markOfflineApplied({db,context:review,eventId:proofEventId,reviewToken,commitReference}));
        assert.equal((await db.collection("gruk_offline_inbox").findOne({empresaId,sedeId,eventId:proofEventId})).status,"EN_REVISION");
      } finally {
        await db.collection("gruk_ledger_movimientos").deleteMany({empresaId,sedeId,actorId:"otroCajero",eventId:proofEventId});
      }
      // A movement from another location under the same company is not commit proof.
      await db.collection("gruk_ledger_movimientos").insertOne({
        empresaId, sedeId: "otraSede", actorId, eventId: proofEventId, deletedAt: null
      });
      try {
        await assert.rejects(
          markOfflineApplied({db,context:review,eventId:proofEventId,reviewToken,commitReference})
        );
        assert.equal((await db.collection("gruk_offline_inbox").findOne({empresaId,sedeId,eventId:proofEventId})).status,"EN_REVISION");
      } finally {
        await db.collection("gruk_ledger_movimientos").deleteMany({empresaId,sedeId:"otraSede",eventId:proofEventId});
      }
      // A ledger movement marked as deleted cannot prove an applied operation.
      await db.collection("gruk_ledger_movimientos").insertOne({
        empresaId, sedeId, actorId, eventId:proofEventId, deletedAt:new Date()
      });
      try {
        await assert.rejects(markOfflineApplied({db,context:review,eventId:proofEventId,reviewToken,commitReference}));
        assert.equal((await db.collection("gruk_offline_inbox").findOne({empresaId,sedeId,eventId:proofEventId})).status,"EN_REVISION");
      } finally {
        await db.collection("gruk_ledger_movimientos").deleteMany({empresaId,sedeId,eventId:proofEventId,deletedAt:{$ne:null}});
      }
      // MongoDB treats {deletedAt:null} as also matching a missing field.
      // An incomplete ledger record must not validate an offline posting.
      await db.collection("gruk_ledger_movimientos").insertOne({
        empresaId, sedeId, actorId, eventId:proofEventId
      });
      try {
        await assert.rejects(
          markOfflineApplied({db,context:review,eventId:proofEventId,reviewToken,commitReference})
        );
        assert.equal((await db.collection("gruk_offline_inbox").findOne({empresaId,sedeId,eventId:proofEventId})).status,"EN_REVISION");
      } finally {
        await db.collection("gruk_ledger_movimientos").deleteMany({empresaId,sedeId,eventId:proofEventId});
      }
      // Ledger evidence with the wrong event ID is not a valid domain commitment.
      await db.collection("gruk_ledger_movimientos").insertOne({
        empresaId, sedeId, actorId, eventId:"01ARZ3NDEKTSV4RRFFQ69G5FB3", deletedAt:null
      });
      try {
        await assert.rejects(markOfflineApplied({db,context:review,eventId:proofEventId,reviewToken,commitReference}));
        assert.equal((await db.collection("gruk_offline_inbox").findOne({empresaId,sedeId,eventId:proofEventId})).status,"EN_REVISION");
      } finally {
        await db.collection("gruk_ledger_movimientos").deleteMany({empresaId,sedeId,eventId:"01ARZ3NDEKTSV4RRFFQ69G5FB3"});
      }
      await db.collection("gruk_ledger_movimientos").insertOne({
        empresaId, sedeId, actorId, eventId: proofEventId, deletedAt: null
      });
      const [appliedA, appliedB] = await Promise.all([
        markOfflineApplied({ db, context: review, eventId: proofEventId, reviewToken, commitReference }),
        markOfflineApplied({ db, context: review, eventId: proofEventId, reviewToken, commitReference })
      ]);
      assert.equal([appliedA.status, appliedB.status].filter(x => x === "APLICADO").length, 1);
      assert.ok([appliedA.status, appliedB.status].every(x => ["APLICADO", "NO_RECLAMADO", "CONFLICTO_CONCURRENCIA"].includes(x)));
      assert.equal((await readOfflineStatuses({db,context,eventIds:[proofEventId]}))[0].applied, true);
      const replayApplied = await markOfflineApplied({ db, context: review, eventId: proofEventId, reviewToken, commitReference });
      assert.equal(replayApplied.status, "NO_RECLAMADO");
    } finally {
      await db.collection("gruk_ledger_movimientos").deleteMany({ empresaId, sedeId, eventId: proofEventId });
      await db.collection("gruk_offline_inbox").deleteMany({ empresaId, sedeId, eventId: proofEventId });
    }
    await assert.rejects(
      acceptOfflineBatch({ db, authenticatedContext: context, events: [{ ...events[0], payload: { localOrderId: "tampered" } }] }),
      error => error.code === "OFFLINE_EVENT_CONFLICT"
    );
  } finally {
    await db.collection("gruk_offline_inbox").deleteMany({ empresaId: { $in: [empresaId, empresaId + "_b"] }, sedeId });
    await connection.close();
  }
});

test("offline ledger finalization rejects unsafe identity before Mongo access", async () => {
  let queried = false;
  const db = { collection: () => { queried = true; throw Error("UNEXPECTED_DB_ACCESS"); } };
  const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const reviewToken = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const commitReference = { collection: "gruk_ledger_movimientos", eventId };
  const base = {empresaId:"empresaTest",sedeId:"sedeTest",actorId:"cajeroTest",canReview:true};
  for (const context of [
    {...base,empresaId:{$ne:null}},
    {...base,sedeId:"sede.bad"},
    {...base,actorId:"cajero$ne"},
    {...base,empresaId:"x".repeat(81)}
  ]) {
    await assert.rejects(
      markOfflineApplied({db,context,eventId,reviewToken,commitReference}),
      /OFFLINE_AUTH_REQUIRED/
    );
  }
  assert.equal(queried, false);
});
