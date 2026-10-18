"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {markOfflineStagedInTransaction:mark}=require("../../core/offline/offlineInboxStaged.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const context={empresaId:"a",sedeId:"b",actorId:"operator"};
function fixture(modifiedCount=1){
 let updates=0;
 const session={inTransaction:()=>true};
 const db={collection(name){
  assert.equal(name,"gruk_offline_inbox");
  return {
   async findOne(key,options){assert.equal(options.session,session);assert.equal(key.status,"PENDIENTE");
    return {...context,status:"PENDIENTE"};},
   async updateOne(key,patch,options){
    assert.equal(options.session,session);
    assert.equal(patch.$set.status,"EN_REVISION");
    assert.equal(patch.$set.financialStageStatus,"PENDIENTE_CONTABILIZACION");
    assert.equal(patch.$set.inventoryApplied,true);
    assert.equal(patch.$set.reviewActorId,context.actorId);
    assert.match(patch.$set.reviewToken,/^[0-9a-f-]{36}$/);
    updates++;return {matchedCount:1,modifiedCount};
   }
  };
 }};
 return {db,session,get updates(){return updates;}};
}
test("inbox staging: one tenant-scoped transition per committed sale in active transaction",async()=>{
 const f=fixture();
 const handoffs=await mark({db:f.db,session:f.session,context,plan:{orders:[{eventId}]}});
 assert.equal(handoffs[0].status,"EN_REVISION");assert.equal(f.updates,1);
});
test("inbox staging: concurrency rejection aborts financial transaction",async()=>{
 const f=fixture(0);
 await assert.rejects(mark({db:f.db,session:f.session,context,plan:{orders:[{eventId}]}}),
  e=>e.code==="OFFLINE_STAGE_INBOX_CONFLICT");
});
test("inbox staging: transaction and valid event IDs are mandatory before Mongo access",async()=>{
 let calls=0;const db={collection(){calls++;throw Error("UNEXPECTED_QUERY");}};
 for(const args of [
  {db,session:null,context,plan:{orders:[{eventId}]}},
  {db,session:{inTransaction:()=>false},context,plan:{orders:[{eventId}]}},
  {db,session:{inTransaction:()=>true},context,plan:{orders:[{eventId},{eventId}]}},
  {db,session:{inTransaction:()=>true},context:{...context,actorId:"$bad"},plan:{orders:[{eventId}]}}
 ]){
  await assert.rejects(mark(args),e=>e.code==="OFFLINE_STAGE_INBOX_CONFLICT");
 }
 assert.equal(calls,0);
});
