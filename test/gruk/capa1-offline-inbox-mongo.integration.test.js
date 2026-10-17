"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {acceptOfflineBatch,ensureInboxIndexes}=require("../../core/offline/offlineInbox.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FAV";
const ctx={empresaId:"tenantA",sedeId:"sedeA",actorId:"userA"};
const event={eventId,empresaId:ctx.empresaId,sedeId:ctx.sedeId,actorId:ctx.actorId,deviceId:"tablet1",tipo:"PEDIDO_REGISTRADO",occurredAt:"2026-10-17T19:00:00.000Z",schemaVersion:1,payload:{producto:"prueba",cantidad:1}};
test("Mongo offline inbox: retries idempotent; changed body conflict; strict tenant isolation",{timeout:120000},async t=>{
 if(!process.env.GRUK_TEST_MONGO_URI){t.skip("Mongo integration enabled in dedicated CI job");return;}
 const {MongoClient}=require("mongodb");
 const client=new MongoClient(process.env.GRUK_TEST_MONGO_URI);
 try{
  await client.connect();
  const db=client.db("offline_guard");
  await ensureInboxIndexes(db);
  assert.deepEqual(await acceptOfflineBatch({db,authenticatedContext:ctx,events:[event]}),[{eventId,status:"RECIBIDO"}]);
  assert.deepEqual(await acceptOfflineBatch({db,authenticatedContext:ctx,events:[event]}),[{eventId,status:"YA_RECIBIDO"}]);
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({empresaId:ctx.empresaId,sedeId:ctx.sedeId}),1);
  await assert.rejects(acceptOfflineBatch({db,authenticatedContext:ctx,events:[{...event,payload:{producto:"alterado",cantidad:2}}]}),/OFFLINE_EVENT_CONFLICT/);
  const other={empresaId:"tenantB",sedeId:"sedeB",actorId:"userB"};
  await assert.rejects(acceptOfflineBatch({db,authenticatedContext:other,events:[event]}),/OFFLINE_TENANT_MISMATCH/);
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({empresaId:"tenantB"}),0);
  const one=await db.collection("gruk_offline_inbox").findOne({empresaId:"tenantA",sedeId:"sedeA",eventId});
  assert.equal(one.status,"PENDIENTE");
 }finally{await client.close();}
});
