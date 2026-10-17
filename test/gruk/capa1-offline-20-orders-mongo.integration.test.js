"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {acceptOfflineBatch,ensureInboxIndexes}=require("../../core/offline/offlineInbox.service");
const {readOfflineStatuses}=require("../../core/offline/offlineStatus.service");
const ctx={empresaId:"gruk20",sedeId:"sede20",actorId:"cajero20"};
const events=Array.from({length:20},(_,i)=>({
 eventId:"01ARZ3NDEKTSV4RRFFQ69G"+String(i).padStart(4,"0"),
 empresaId:ctx.empresaId,sedeId:ctx.sedeId,actorId:ctx.actorId,
 deviceId:"tablet20",tipo:"PEDIDO_REGISTRADO",
 occurredAt:"2026-10-17T19:00:00.000Z",schemaVersion:1,
 payload:{linea:i+1,producto:"prueba",cantidad:1}
}));
test("20 offline orders: retry after interrupted response does not duplicate Mongo inbox",{timeout:120000},async t=>{
 if(!process.env.GRUK_TEST_MONGO_URI){t.skip("Mongo integration enabled in CI");return;}
 const {MongoClient}=require("mongodb");
 const client=new MongoClient(process.env.GRUK_TEST_MONGO_URI);
 try{
  await client.connect();const db=client.db("offline_20_orders");
  await ensureInboxIndexes(db);
  const first=await acceptOfflineBatch({db,authenticatedContext:ctx,events});
  assert.equal(first.length,20);
  assert.ok(first.every(e=>e.status==="RECIBIDO"));
  // Device loses the 202 response and resends the same entire batch.
  const retry=await acceptOfflineBatch({db,authenticatedContext:ctx,events});
  assert.equal(retry.length,20);
  assert.ok(retry.every(e=>e.status==="YA_RECIBIDO"));
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({empresaId:ctx.empresaId,sedeId:ctx.sedeId}),20);
  const status=await readOfflineStatuses({db,context:ctx,eventIds:events.map(e=>e.eventId)});
  assert.equal(status.length,20);
  assert.ok(status.every(e=>e.status==="PENDIENTE"&&e.applied===false));
 }finally{await client.close();}
});
