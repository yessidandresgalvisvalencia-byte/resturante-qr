"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {recoverOfflineStagedBatch:recover}=require("../../core/offline/offlineStageRecovery.service");
const ctx={empresaId:"a",sedeId:"b",actorId:"op"};
const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
function fixture({missing=false,tampered=false,paid=false,duplicate=false}={}){
 let calls=0;
 const scope=ids.map(eventId=>({...ctx,eventId}));
 const rows={
  gruk_offline_inbox:scope.map(s=>({...s,status:"EN_REVISION",financialStageStatus:"PENDIENTE_CONTABILIZACION",inventoryApplied:true,stagedBy:"op"})),
  gruk_offline_ventas:scope.map(s=>({...s,status:"PENDIENTE_CONTABILIZACION",totalCop:"3000"})),
  gruk_offline_caja_intenciones:scope.map(s=>({...s,status:"PENDIENTE_CONCILIACION",cobrado:false,montoCop:"3000"})),
  gruk_ledger_movimientos:scope.map(s=>({...s,tipo:"VENTA_OFFLINE",deletedAt:null,montoCop:"3000"}))
 };
 if(missing)rows.gruk_offline_ventas.pop();
 if(tampered)rows.gruk_offline_inbox[0].inventoryApplied=false;
 if(paid)rows.gruk_offline_caja_intenciones[0].cobrado=true;
 if(duplicate)rows.gruk_offline_ventas.push(rows.gruk_offline_ventas[0]);
 return {collection(name){calls++;return {find(q){
  assert.equal(q.empresaId,"a");assert.equal(q.sedeId,"b");assert.equal(q.actorId,"op");
  assert.deepEqual(q.eventId.$in,ids);
  return {toArray:async()=>rows[name].map(({empresaId,sedeId,actorId,...fields})=>fields)};
 }};},get calls(){return calls;}};
}
test("read-only stage recovery recognizes complete staged batch with exact COP sum",async()=>{
 const db=fixture();
 const result=await recover({db,context:ctx,eventIds:ids});
 assert.deepEqual(result,{status:"PENDIENTE_CONTABILIZACION",alreadyStaged:true,
 applied:false,cobrado:false,processedEvents:2,totalCop:"6000"});
 assert.equal(db.calls,7);
});
test("recovery refuses partial, duplicate or tampered financial evidence",async()=>{
 for(const option of [{missing:true},{tampered:true},{paid:true},{duplicate:true}]){
  await assert.rejects(recover({db:fixture(option),context:ctx,eventIds:ids}),
   e=>e.code==="OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW");
 }
});
test("recovery never opens Mongo for invalid ID inputs",async()=>{
 let queries=0;const db={collection(){queries++;throw Error("UNEXPECTED_ACCESS");}};
 await assert.rejects(recover({db,context:ctx,eventIds:[]}),/OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW/);
 assert.equal(queries,0);
});
