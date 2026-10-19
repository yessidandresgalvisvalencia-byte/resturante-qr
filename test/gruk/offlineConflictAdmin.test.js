"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {listStockConflicts,appendStockConflictReview}=require("../../core/offline/offlineConflictAdmin.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",
 usuarioId:"admin",rol:"ADMIN_SEDE"};
const conflictId="offline-stock-"+"a".repeat(64);
const decisionId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
function dbMock(){
 const logs=[];let stored=null;let reads=0,writes=0;
 const original={_id:conflictId,...auth,actorId:"operator",status:"REQUIERE_REVISION",
  applied:false,cobrado:false,eventIds:["01ARZ3NDEKTSV4RRFFQ69G5FA1"],
  issues:[{productoId:"507f1f77bcf86cd799439011",disponible:"0",solicitado:"1",faltante:"1"}]};
 return {db:{collection(name){
  if(name==="gruk_offline_stock_conflicts")return {
   find(query,options){reads++;logs.push({query,options});
    return {toArray:async()=>[original]};},
   async findOne(query){reads++;logs.push({query});return query._id===conflictId?original:null;}
  };
  if(name==="gruk_offline_stock_conflict_reviews")return {
   async updateOne(key,patch,options){
    writes++;assert.equal(options.upsert,true);assert.equal(key.empresaId,auth.empresaId);
    if(!stored)stored=patch.$setOnInsert;return stored?{matchedCount:1}:{upsertedCount:1};
   },async findOne(){return stored;}
  };
  throw Error("UNKNOWN_COLLECTION");
 }},logs,get reads(){return reads;},get writes(){return writes;}};
}
test("stock conflict: only admins can list/review; reject user-supplied tenant",async()=>{
 const fixture=dbMock();
 for(const bad of [{...auth,rol:"EMPLEADO"},{...auth,sedeId:"$ne"},{...auth,rol:"ADMIN"}]){
  await assert.rejects(listStockConflicts({db:fixture.db,auth:bad}),/OFFLINE_CONFLICT_PERMISSION_DENIED/);
  await assert.rejects(appendStockConflictReview({db:fixture.db,auth:bad,conflictId,
   decisionId,action:"ACUSAR_RECIBO",note:"Confirmado para revisión"}),/OFFLINE_CONFLICT_PERMISSION_DENIED/);
 }
 assert.equal(fixture.reads,0);assert.equal(fixture.writes,0);
});
test("stock conflict: list is scoped by company/site with bounded query",async()=>{
 const fixture=dbMock();
 const rows=await listStockConflicts({db:fixture.db,auth,limit:25});
 assert.equal(rows.length,1);
 assert.equal(rows[0].conflictId,conflictId);
 assert.deepEqual(fixture.logs[0].query,{
  empresaId:auth.empresaId,sedeId:auth.sedeId,status:"REQUIERE_REVISION"});
 assert.equal(fixture.logs[0].options.limit,25);
 await assert.rejects(listStockConflicts({db:fixture.db,auth,limit:101}),/OFFLINE_CONFLICT_INVALID_LIMIT/);
});
test("stock conflict: append-only review is idempotent, never touches source conflict",async()=>{
 const fixture=dbMock(),args={db:fixture.db,auth,conflictId,decisionId,
  action:"SOLICITAR_REABASTECIMIENTO",note:"Solicitar una nueva unidad"};
 const first=await appendStockConflictReview(args),second=await appendStockConflictReview(args);
 assert.deepEqual(first,second);
 assert.equal(first.status,"REVISION_REGISTRADA");assert.equal(first.applied,false);
 assert.equal(first.cobrado,false);assert.equal(fixture.writes,2);
});
test("stock conflict: invalid decisions do not access database",async()=>{
 const fixture=dbMock(),base={db:fixture.db,auth,conflictId,decisionId,
  action:"ACUSAR_RECIBO",note:"Revisión del faltante"};
 for(const patch of [{conflictId:"bad"},{decisionId:"bad"},{action:"DESCONTAR_STOCK"},
  {note:"corto"},{note:" ".repeat(12)}]){
  await assert.rejects(appendStockConflictReview({...base,...patch}),/OFFLINE_CONFLICT_REVIEW_INVALID/);
 }
 assert.equal(fixture.reads,0);assert.equal(fixture.writes,0);
});

test("Capa 2: administrative list refuses poisoned or incomplete persisted conflicts",async()=>{
 const valid={_id:conflictId,empresaId:auth.empresaId,sedeId:auth.sedeId,
  actorId:"operator",status:"REQUIERE_REVISION",applied:false,cobrado:false,
  eventIds:["01ARZ3NDEKTSV4RRFFQ69G5FA1"],issues:[{productoId:"507f1f77bcf86cd799439011"}]};
 for(const patch of [
  {empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},
  {status:"APLICADO"},{applied:true},{cobrado:true},
  {applied:undefined},{cobrado:undefined},
  {_id:"invalid"},{actorId:undefined},
  {eventIds:[]},{eventIds:["invalid"]},
  {eventIds:[valid.eventIds[0],valid.eventIds[0]]},{issues:[]}
 ]){
  const db={collection(name){
   assert.equal(name,"gruk_offline_stock_conflicts");
   return {find(query,options){
    assert.equal(query.empresaId,auth.empresaId);
    assert.equal(query.sedeId,auth.sedeId);
    assert.equal(options.projection.applied,1);
    assert.equal(options.projection.cobrado,1);
    return {toArray:async()=>[{...valid,...patch}]};
   }};
  }};
  await assert.rejects(listStockConflicts({db,auth}),{code:"OFFLINE_CONFLICT_SCOPE_MISMATCH"});
 }
});
