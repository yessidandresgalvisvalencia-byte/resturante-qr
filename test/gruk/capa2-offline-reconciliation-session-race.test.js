"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {reconcileReceived}=require("../../public/js/gruk-offline-transport");
const ctx={empresaId:"empresaA",sedeId:"sedeA",actorId:"operadorA"};
const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
const proof=id=>({eventId:id,status:"APLICADO",applied:true,
 staged:true,financiallyReconciled:true});
test("Capa 2: revocación entre dos conciliaciones conserva segunda sin actualización bajo sesión anterior",async()=>{
 let active=true;
 const persisted=new Map(),requests=[];
 const outbox={
  listReceived:async()=>ids.map(eventId=>({eventId})),
  markReconciled:async(eventId,identity,result)=>{
   assert.deepEqual(identity,ctx);
   assert.deepEqual(result,proof(eventId));
   persisted.set(eventId,result);
   if(eventId===ids[0])active=false;
   return true;
  }
 };
 const fetchFn=async(url,options)=>{
  assert.equal(url,"/api/sync/reconciliation");
  assert.equal(options.headers.Authorization,requests.length===0?"Bearer token-original":"Bearer token-renovado");
  const requested=JSON.parse(options.body).eventIds;
  assert.deepEqual(requested,ids);
  requests.push(requested);
  return {status:200,json:async()=>({
   ok:true,readOnly:true,events:requested.map(proof)
  })};
 };
 await assert.rejects(reconcileReceived({
  outbox,context:ctx,token:"token-original",fetchFn,isSessionCurrent:()=>active
 }),{message:"SYNC_SESSION_CHANGED"});
 assert.deepEqual([...persisted.keys()],[ids[0]],
  "La segunda evidencia no puede persistirse después de la revocación");
 active=true;
 const recovered=await reconcileReceived({
  outbox,context:ctx,token:"token-renovado",fetchFn,isSessionCurrent:()=>active
 });
 assert.deepEqual(recovered,{checked:2,updated:2});
 assert.deepEqual([...persisted.keys()],ids);
 assert.equal(requests.length,2);
});
test("Capa 2: cambio de empresa durante lectura de respuesta financiera no altera la cola",async()=>{
 const mutable={...ctx};let updates=0;
 const outbox={
  listReceived:async()=>ids.map(eventId=>({eventId})),
  markReconciled:async()=>{updates++;return true;}
 };
 await assert.rejects(reconcileReceived({
  outbox,context:mutable,token:"jwt",
  fetchFn:async()=>({status:200,json:async()=>{
   mutable.empresaId="empresaB";
   return {ok:true,readOnly:true,events:ids.map(proof)};
  }})
 }),{message:"SYNC_SESSION_CHANGED"});
 assert.equal(updates,0);
});
