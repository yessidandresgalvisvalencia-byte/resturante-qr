"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {acceptOfflineBatch,ensureInboxIndexes}=require("../../core/offline/offlineInbox.service");
const {readOfflineStatuses}=require("../../core/offline/offlineStatus.service");
const ctx={empresaId:"tenantConcurrent",sedeId:"sedeConcurrent",actorId:"cajeroConcurrent"};
const events=Array.from({length:20},(_,i)=>({
 eventId:"01ARZ3NDEKTSV4RRFFQ69G"+String(i).padStart(4,"0"),
 empresaId:ctx.empresaId,sedeId:ctx.sedeId,actorId:ctx.actorId,
 deviceId:i%2===0?"tabletA":"tabletB",
 tipo:"PEDIDO_REGISTRADO",occurredAt:"2026-10-17T20:00:00.000Z",
 schemaVersion:1,payload:{producto:"stockCompartido",cantidad:1,linea:i}
}));
test("two tablets concurrent retries retain 20 unique pending records",{timeout:120000},async t=>{
 if(!process.env.GRUK_TEST_MONGO_URI){t.skip("Mongo replica set CI required");return;}
 const {MongoClient}=require("mongodb");
 const client=new MongoClient(process.env.GRUK_TEST_MONGO_URI);
 try{
  await client.connect();const db=client.db("offline_concurrent_20");
  await ensureInboxIndexes(db);
  const tabletA=events.filter(e=>e.deviceId==="tabletA");
  const tabletB=events.filter(e=>e.deviceId==="tabletB");
  const batches=[tabletA,tabletB,tabletA,tabletB];
  const replies=await Promise.all(batches.map(batch=>acceptOfflineBatch({db,authenticatedContext:ctx,events:batch})));
  assert.equal(replies.flat().length,40);
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({empresaId:ctx.empresaId,sedeId:ctx.sedeId}),20);
  const stored=await readOfflineStatuses({db,context:ctx,eventIds:events.map(e=>e.eventId)});
  assert.equal(stored.length,20);
  assert.ok(stored.every(e=>e.status==="PENDIENTE"&&!e.applied));
  const ledgerCount=await db.collection("gruk_ledger_movimientos").countDocuments({});
  assert.equal(ledgerCount,0,"inbox reception must not post revenue");
 }finally{await client.close();}
});
