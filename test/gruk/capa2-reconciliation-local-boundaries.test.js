"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {reconcileReceived}=require("../../public/js/gruk-offline-transport");
const ctx={empresaId:"empresaA",sedeId:"sedeA",actorId:"actorA"};
const id="01ARZ3NDEKTSV4RRFFQ69G5FAV";
test("Capa 2: la reconciliación rechaza outbox corrupta sin tocar red",async()=>{
 for(const rows of [null,{},[null],Array.from({length:3},()=>({eventId:id})),
   [{eventId:id,empresaId:"empresaB"}],
   [{eventId:id,sedeId:"sedeB"}],
   [{eventId:id,actorId:"otro"}]]){
  let touched=0;
  const outbox={listReceived:async()=>rows,markReconciled:async()=>{touched++;return true;}};
  await assert.rejects(reconcileReceived({outbox,context:ctx,limit:2,token:"token",
    fetchFn:async()=>{touched++;throw Error("UNEXPECTED_NETWORK");}}),/SYNC_INVALID_LOCAL_EVENTS/);
  assert.equal(touched,0);
 }
});
test("Capa 2: lote válido conserva consulta de estado de solo lectura",async()=>{
 const outbox={listReceived:async()=>[{eventId:id,empresaId:ctx.empresaId,sedeId:ctx.sedeId,actorId:ctx.actorId}],
   markReconciled:async(eventId,context,status)=>{
    assert.equal(eventId,id);assert.deepEqual(context,ctx);assert.equal(status.status,"PENDIENTE");return true;}};
 const result=await reconcileReceived({outbox,context:ctx,token:"token",fetchFn:async(url)=>{
  assert.equal(url,"/api/sync/reconciliation");
  return {status:200,json:async()=>({ok:true,readOnly:true,events:[{
   eventId:id,status:"PENDIENTE",applied:false,staged:false,financiallyReconciled:false
  }]})};
 }});
 assert.deepEqual(result,{checked:1,updated:1});
});
