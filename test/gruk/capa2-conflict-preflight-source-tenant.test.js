"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {preflightOfflineConflict}=require("../../core/offline/offlineConflictPreflight.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",usuarioId:"admin",rol:"ADMIN_SEDE"};
const conflictId="offline-stock-"+"a".repeat(64);
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
function fake(patch={}){
 let downstream=0;
 const db={collection(name){
  if(name==="gruk_offline_stock_conflicts")return {async findOne(q,opt){
   assert.equal(q.empresaId,auth.empresaId);
   assert.equal(q.sedeId,auth.sedeId);
   for(const field of ["empresaId","sedeId","status","applied","cobrado"])assert.equal(opt.projection[field],1);
   return {_id:conflictId,empresaId:auth.empresaId,sedeId:auth.sedeId,
    status:"REQUIERE_REVISION",applied:false,cobrado:false,actorId:"operator",eventIds:[eventId],...patch};
  }};
  downstream++;
  throw Error("FOREIGN_DATA_LOOKUP");
 }};
 return {db,get downstream(){return downstream;}};
}
test("Capa 2: corrupted company/site conflict cannot trigger event/stock reads",async()=>{
 for(const patch of [{empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},{empresaId:undefined},
  {sedeId:undefined},{_id:"offline-stock-"+"b".repeat(64)},
  {status:"RESUELTO"},{applied:true},{cobrado:true}]){
  const s=fake(patch);
  await assert.rejects(preflightOfflineConflict({
   db:s.db,auth,conflictId,objectId:x=>x
  }),{code:"OFFLINE_CONFLICT_NOT_FOUND"});
  assert.equal(s.downstream,0);
 }
});
test("Capa 2: verified conflict proceeds to scoped original order reader",async()=>{
 const s=fake();
 await assert.rejects(preflightOfflineConflict({
  db:s.db,auth,conflictId,objectId:x=>x
 }),/FOREIGN_DATA_LOOKUP/);
 assert.equal(s.downstream,1);
});
