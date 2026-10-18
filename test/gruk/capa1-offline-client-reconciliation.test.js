"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {reconcileReceived}=require("../../public/js/gruk-offline-transport");
const ctx={empresaId:"A",sedeId:"S",actorId:"U"};
const a="01ARZ3NDEKTSV4RRFFQ69G5FA0",b="01ARZ3NDEKTSV4RRFFQ69G5FA1";
function outbox(){
 const updates=[];return {updates,listReceived:async()=>[{eventId:a},{eventId:b}],
  markReconciled:async(id,scope,event)=>{assert.equal(scope,ctx);updates.push({id,event});return true;}};
}
const records=[
 {eventId:a,status:"EN_REVISION",staged:true,financiallyReconciled:false,applied:false},
 {eventId:b,status:"APLICADO",staged:true,financiallyReconciled:true,applied:true}
];
test("reconcileReceived: server status only, no sales posting, preserves local events",async()=>{
 const local=outbox();let calls=0;
 const result=await reconcileReceived({outbox:local,context:ctx,token:"jwt",fetchFn:async(url,options)=>{
  calls++;assert.equal(url,"/api/sync/reconciliation");assert.equal(options.method,"POST");
  assert.equal(options.headers.Authorization,"Bearer jwt");assert.equal(options.cache,"no-store");
  assert.deepEqual(JSON.parse(options.body),{eventIds:[a,b]});
  return {status:200,json:async()=>({ok:true,readOnly:true,events:records})};
 }});
 assert.deepEqual(result,{checked:2,updated:2});assert.equal(local.updates.length,2);assert.equal(calls,1);
});
test("reconcileReceived: invalid, duplicated, or partial response never modifies local records",async()=>{
 const invalid=[
  [records[0]],
  [records[0],records[0]],
  [{...records[0],eventId:"not-requested"},records[1]],
  [{...records[0],applied:true},records[1]],
  [{...records[0],staged:false,financiallyReconciled:true},records[1]],
  [{...records[1],status:"PENDIENTE"},records[0]]
 ];
 for(const events of invalid){
  const local=outbox();
  await assert.rejects(reconcileReceived({outbox:local,context:ctx,token:"jwt",fetchFn:async()=>({
   status:200,json:async()=>({ok:true,readOnly:true,events})
  })}),/SYNC_INVALID_RECONCILIATION/);
  assert.equal(local.updates.length,0);
 }
});
test("reconcileReceived: missing events do not erase stored receipt",async()=>{
 const local=outbox();const rows=[{eventId:a,status:"NO_ENCONTRADO",applied:false,staged:false,financiallyReconciled:false},records[1]];
 const result=await reconcileReceived({outbox:local,context:ctx,token:"jwt",fetchFn:async()=>({
  status:200,json:async()=>({ok:true,readOnly:true,events:rows})
 })});
 assert.deepEqual(result,{checked:2,updated:1});assert.equal(local.updates[0].id,b);
});
test("reconcileReceived: no token or unauthorized server never modifies local records",async()=>{
 const local=outbox();let requests=0;
 await assert.rejects(reconcileReceived({outbox:local,context:ctx,token:"",fetchFn:async()=>{requests++;}}),/SYNC_AUTH_REQUIRED/);
 await assert.rejects(reconcileReceived({outbox:local,context:ctx,token:"jwt",fetchFn:async()=>({status:403})}),/SYNC_RECONCILIATION_UNAVAILABLE/);
 assert.equal(requests,0);assert.equal(local.updates.length,0);
});
