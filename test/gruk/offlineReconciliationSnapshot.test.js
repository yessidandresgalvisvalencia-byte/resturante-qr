"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readOfflineReconciliation:read}=require("../../core/offline/offlineReconciliation.service");
const ctx={empresaId:"empresaA",sedeId:"sedeA",actorId:"cajeroA"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
function fixture(afterQuery=()=>{}){
 const logs=[];
 const records={
  gruk_offline_inbox:[{...ctx,eventId,status:"EN_REVISION",inventoryApplied:true}],
  gruk_offline_ventas:[{...ctx,eventId,status:"PENDIENTE_CONTABILIZACION",totalCop:"3000"}],
  gruk_offline_caja_intenciones:[{...ctx,eventId,status:"PENDIENTE_CONCILIACION",cobrado:false,montoCop:"3000"}],
  gruk_ledger_movimientos:[{...ctx,eventId,tipo:"VENTA_OFFLINE",montoCop:"3000",deletedAt:null}]
 };
 return {db:{collection(name){return {find(query){
  logs.push({name,empresaId:query.empresaId,sedeId:query.sedeId,
   actorId:query.actorId,ids:[...query.eventId.$in]});
  afterQuery();
  return {toArray:async()=>records[name]};
 }}}},logs};
}
test("Capa 2: conciliación fija el tenant y los IDs aunque cambien tras la primera consulta",async()=>{
 const context={...ctx},ids=[eventId];
 const f=fixture(()=>{Object.assign(context,{empresaId:"intruso",sedeId:"sedeB",actorId:"otro"});ids[0]="01ARZ3NDEKTSV4RRFFQ69G5FA1";});
 const result=await read({db:f.db,context,eventIds:ids});
 assert.deepEqual(result,[{eventId,status:"EN_REVISION",staged:true,financiallyReconciled:false,applied:false}]);
 assert.equal(f.logs.length,4);
 for(const log of f.logs){
  assert.equal(log.empresaId,ctx.empresaId);
  assert.equal(log.sedeId,ctx.sedeId);
  assert.deepEqual(log.ids,[eventId]);
  if(log.name==="gruk_offline_inbox")assert.equal(log.actorId,ctx.actorId);
 }
});
test("Capa 2: no consulta Mongo con getters tenant ni índices ULID",async()=>{
 for(const key of ["empresaId","sedeId","actorId"]){
  let reads=0,hits=0;const context={...ctx};
  Object.defineProperty(context,key,{configurable:true,enumerable:true,get(){hits++;return ctx[key];}});
  await assert.rejects(read({db:{get collection(){reads++;throw Error("FORBIDDEN");}},
   context,eventIds:[eventId]}),{code:"OFFLINE_AUTH_REQUIRED"});
  assert.equal(hits,0);assert.equal(reads,0);
 }
 const ids=[eventId];let hits=0,reads=0;
 Object.defineProperty(ids,0,{configurable:true,enumerable:true,get(){hits++;return eventId;}});
 await assert.rejects(read({db:{get collection(){reads++;throw Error("FORBIDDEN");}},
  context:ctx,eventIds:ids}),{code:"OFFLINE_INVALID_IDS"});
 assert.equal(hits,0);assert.equal(reads,0);
});
