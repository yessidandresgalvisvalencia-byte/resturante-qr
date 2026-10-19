"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {markOfflineStagedInTransaction:mark}=require("../../core/offline/offlineInboxStaged.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const context={empresaId:"a",sedeId:"b",actorId:"operator"};
function fixture(modifiedCount=1){
 let updates=0,staged=null;
 const session={inTransaction:()=>true};
 const db={collection(name){
  assert.equal(name,"gruk_offline_inbox");
  return {
   async findOne(key,options){assert.equal(options.session,session);
    if(key.status==="EN_REVISION")return staged;
    assert.equal(key.status,"PENDIENTE");
    return {...context,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE"};},
   async updateOne(key,patch,options){
    assert.equal(options.session,session);
    assert.equal(patch.$set.status,"EN_REVISION");
    assert.equal(patch.$set.financialStageStatus,"PENDIENTE_CONTABILIZACION");
    assert.equal(patch.$set.inventoryApplied,true);
    assert.equal(patch.$set.reviewActorId,context.actorId);
    assert.match(patch.$set.reviewToken,/^[0-9a-f-]{36}$/);
    updates++;staged={...context,eventId,tipo:"PEDIDO_REGISTRADO",...patch.$set};
    return {matchedCount:1,modifiedCount};
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

test("Capa 2: staged inbox refuses foreign identity and different event before any write",async()=>{
 for(const patch of [
  {empresaId:"empresa-ajena"},{sedeId:"sede-ajena"},{actorId:"operador-ajeno"},
  {eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1"},{tipo:"OTRO"},{status:"APLICADO"},
  {empresaId:undefined},{sedeId:undefined},{actorId:undefined},{eventId:undefined}
 ]){
  let writes=0;
  const session={inTransaction:()=>true};
  const db={collection(name){assert.equal(name,"gruk_offline_inbox");return{
   async findOne(query,options){
    assert.equal(query.empresaId,context.empresaId);
    assert.equal(query.sedeId,context.sedeId);
    assert.equal(query.actorId,context.actorId);
    for(const field of ["empresaId","sedeId","actorId","eventId","tipo","status"])
     assert.equal(options.projection[field],1);
    return {...context,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",...patch};
   },
   async updateOne(){writes++;throw Error("UNAUTHORIZED_WRITE");}
  };}};
  await assert.rejects(mark({db,session,context,plan:{orders:[{eventId}]}}),
   {code:"OFFLINE_STAGE_INBOX_CONFLICT"});
  assert.equal(writes,0);
 }
});

test("Capa 2: persisted stage handoff cannot be accepted with foreign or missing proof",async()=>{
 const patches=[
  {empresaId:"another-company"},{sedeId:"another-site"},
  {actorId:"another-operator"},{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1"},
  {status:"APLICADO"},{financialStageStatus:"CONCILIADO"},
  {inventoryApplied:false},{stagedBy:"another-operator"},
  {reviewActorId:"another-operator"},{reviewToken:"forged-token"},
  {reviewToken:undefined},{tipo:"OTRO"}
 ];
 for(const patch of patches){
  let writes=0;
  const session={inTransaction:()=>true};
  const db={collection(name){
   assert.equal(name,"gruk_offline_inbox");
   let staged=null;
   return {
    async findOne(query,options){
     assert.equal(options.session,session);
     if(query.status==="PENDIENTE")return {...context,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE"};
     assert.equal(query.status,"EN_REVISION");
     return {...staged,...patch};
    },
    async updateOne(key,update,options){
     assert.equal(options.session,session);writes++;
     staged={...context,eventId,tipo:"PEDIDO_REGISTRADO",...update.$set};
     return {matchedCount:1,modifiedCount:1};
    }
   };
  }};
  await assert.rejects(mark({db,session,context,plan:{orders:[{eventId}]}}),
   {code:"OFFLINE_STAGE_INBOX_CONFLICT"});
  assert.equal(writes,1);
 }
});
