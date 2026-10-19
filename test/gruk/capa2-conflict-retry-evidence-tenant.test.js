"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {retryOfflineConflict}=require("../../core/offline/offlineConflictRetry.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",usuarioId:"admin",rol:"ADMIN_SEDE"};
const conflictId="offline-stock-"+"a".repeat(64);
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const source={_id:conflictId,empresaId:auth.empresaId,sedeId:auth.sedeId,
 status:"REQUIERE_REVISION",applied:false,cobrado:false,actorId:"operator",eventIds:[eventId]};
const args=db=>({db,auth,conflictId,confirmed:true,note:"Revisión autorizada"});
function fake(sourcePatch={},resolution=null){
 let reads=0;
 return {get reads(){return reads;},db:{
  client:{startSession(){throw Error("MUST_NOT_START_TRANSACTION");}},
  collection(name){
   if(name==="gruk_offline_stock_conflicts")return {
    async findOne(q,options){
     reads++;
     assert.equal(q.empresaId,auth.empresaId);
     assert.equal(q.sedeId,auth.sedeId);
     assert.equal(options.projection.empresaId,1);
     assert.equal(options.projection.sedeId,1);
     return {...source,...sourcePatch};
    }
   };
   if(name==="gruk_offline_stock_resolutions")return {
    async findOne(q){
     reads++;
     assert.equal(q.empresaId,auth.empresaId);
     assert.equal(q.sedeId,auth.sedeId);
     return resolution;
    }
   };
   throw Error("UNSCOPED_READ_OR_WRITE");
  }
 }};
}
test("Capa 2: retry rejects forged source before reading resolutions or opening sessions",async()=>{
 for(const patch of [
  {empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},
  {_id:"offline-stock-"+"b".repeat(64)},
  {status:"OTRO"},{applied:true},{cobrado:true},
  {empresaId:undefined},{sedeId:undefined}
 ]){
  const f=fake(patch);
  await assert.rejects(retryOfflineConflict(args(f.db)),
   {code:"OFFLINE_CONFLICT_RETRY_SOURCE_INVALID"});
  assert.equal(f.reads,1);
 }
});
test("Capa 2: corrupted resolution never certifies retry idempotency",async()=>{
 const base={_id:conflictId,empresaId:auth.empresaId,sedeId:auth.sedeId,
  actorId:"operator",status:"STAGED",eventIds:[eventId],applied:false,cobrado:false};
 for(const patch of [
  {empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},
  {_id:"offline-stock-"+"b".repeat(64)},{eventIds:undefined},
  {empresaId:undefined},{applied:true},{cobrado:true},
  {applied:undefined},{cobrado:undefined}
 ]){
  const f=fake({}, {...base,...patch});
  await assert.rejects(retryOfflineConflict(args(f.db)),
   {code:"OFFLINE_CONFLICT_RESOLUTION_INCONSISTENT"});
  assert.equal(f.reads,2);
 }
});

test("Capa 2: replay cannot declare an already reconciled cash event unpaid",async()=>{
 const base={_id:conflictId,empresaId:auth.empresaId,sedeId:auth.sedeId,
  actorId:"operator",status:"STAGED",eventIds:[eventId],applied:false,cobrado:false};
 let writes=0,queries=0;
 const key={empresaId:auth.empresaId,sedeId:auth.sedeId,actorId:"operator",eventId};
 const rows={
  gruk_offline_inbox:[{...key,status:"EN_REVISION",inventoryApplied:true}],
  gruk_offline_ventas:[{...key,status:"CONTABILIZADA",totalCop:"3000"}],
  gruk_offline_caja_intenciones:[{...key,status:"CONCILIADO",montoCop:"3000",cobrado:true}],
  gruk_ledger_movimientos:[{...key,tipo:"VENTA_OFFLINE",montoCop:"3000",deletedAt:null}]
 };
 const db={client:{startSession(){throw Error("UNEXPECTED_TRANSACTION");}},
  collection(name){
   if(name==="gruk_offline_stock_conflicts")return {async findOne(){return source;}};
   if(name==="gruk_offline_stock_resolutions")return {async findOne(){return base;}};
   if(Object.hasOwn(rows,name))return {find(q){
    queries++;
    assert.equal(q.empresaId,auth.empresaId);
    assert.equal(q.sedeId,auth.sedeId);
    return {toArray:async()=>rows[name]};
   }};
   writes++;throw Error("UNEXPECTED_WRITE");
  }};
 await assert.rejects(retryOfflineConflict(args(db)),{
  code:"OFFLINE_CONFLICT_RESOLUTION_INCONSISTENT"
 });
 assert.equal(queries,4);
 assert.equal(writes,0);
});
