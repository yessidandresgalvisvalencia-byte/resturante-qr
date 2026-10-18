"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {assertAuthorization}=require("../../core/offline/offlineConflictRetry.service");
const panel=require("../../public/js/gruk-offline-conflicts-panel");
const cid="offline-stock-"+"a".repeat(64);
const auth={empresaId:"507f191e810c19729de860ea",
 sedeId:"507f1f77bcf86cd799439012",usuarioId:"supervisor",rol:"ADMIN_SEDE"};
test("conflict retry supervisor: must have rights, explicit confirmation and reason",()=>{
 for(const bad of [{...auth,rol:"EMPLEADO"},{...auth,empresaId:"$ne"},
   {...auth,sedeId:"invalid"}]){
  assert.throws(()=>assertAuthorization(bad,cid,true,"Stock replenished correctly"),
   /OFFLINE_CONFLICT_PERMISSION_DENIED/);
 }
 assert.throws(()=>assertAuthorization(auth,cid,false,"Stock replenished correctly"),
  /OFFLINE_CONFLICT_RETRY_CONFIRMATION_REQUIRED/);
 assert.throws(()=>assertAuthorization(auth,cid,true,"short"),/OFFLINE_CONFLICT_RETRY_INVALID/);
 assert.deepEqual(assertAuthorization(auth,cid,true,"Stock replenished correctly"),{
  empresaId:auth.empresaId,sedeId:auth.sedeId
 });
});
test("conflict retry UI: only explicit POST, never reports money charged",async()=>{
 let requests=0;
 const result=await panel.retry({token:"jwt",conflictId:cid,
  confirmed:true,note:"Restocked inventory and authorized retry",
  fetchFn:async(url,options)=>{
   requests++;assert.equal(url,"/api/sync/stock-conflicts/retry");
   assert.equal(options.method,"POST");assert.equal(options.cache,"no-store");
   const body=JSON.parse(options.body);
   assert.equal(body.confirmed,true);assert.equal(body.conflictId,cid);
   return {status:202,json:async()=>({ok:true,conflictId:cid,status:"STAGED",
    alreadyResolved:false,inventoryApplied:true,applied:false,cobrado:false})};
  }});
 assert.equal(result.applied,false);assert.equal(result.cobrado,false);assert.equal(requests,1);
 await assert.rejects(panel.retry({token:"jwt",conflictId:cid,confirmed:false,
  note:"Restocked inventory and authorized retry",fetchFn:async()=>{requests++;}}),
  /OFFLINE_REVIEW_RETRY_INVALID/);
 assert.equal(requests,1);
});
