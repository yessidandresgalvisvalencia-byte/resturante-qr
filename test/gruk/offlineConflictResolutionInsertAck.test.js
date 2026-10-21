"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {assertResolutionInsertAcknowledged}=require("../../core/offline/offlineConflictRetry.service");
const conflictId="offline-stock-"+"a".repeat(64);
test("Capa 2: insert de resolución debe confirmar acuse e identidad exacta",()=>{
 assert.equal(assertResolutionInsertAcknowledged({acknowledged:true,insertedId:conflictId},conflictId),true);
 for(const response of [undefined,null,{}, {acknowledged:false,insertedId:conflictId},
  {acknowledged:1,insertedId:conflictId},{acknowledged:true},
  {acknowledged:true,insertedId:"offline-stock-"+"b".repeat(64)},
  {acknowledged:true,insertedId:null}]){
  assert.throws(()=>assertResolutionInsertAcknowledged(response,conflictId),
   {code:"OFFLINE_CONFLICT_RESOLUTION_WRITE_UNVERIFIED"});
 }
});
