"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {appendStockConflictReview}=require("../../core/offline/offlineConflictAdmin.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",usuarioId:"admin",rol:"ADMIN_SEDE"};
const conflictId="offline-stock-"+"a".repeat(64);
const decisionId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const original={_id:conflictId,empresaId:auth.empresaId,sedeId:auth.sedeId,actorId:"operator",status:"REQUIERE_REVISION",applied:false,cobrado:false,eventIds:["01ARZ3NDEKTSV4RRFFQ69G5FA1"],issues:[{productoId:"507f1f77bcf86cd799439011",disponible:"0",solicitado:"1",faltante:"1"}]};
test("Capa 2: una revisión sin acuse verificable jamás se marca registrada",async()=>{
 for(const ack of [null,undefined,{}, {acknowledged:false,upsertedCount:1},
   {acknowledged:true,upsertedCount:-1},{acknowledged:true,upsertedCount:2},
   {acknowledged:true,upsertedCount:"1"},{upsertedCount:1}]){
  let reviewReads=0;
  const db={collection(name){
   if(name==="gruk_offline_stock_conflicts")return {findOne:async()=>original};
   if(name==="gruk_offline_stock_conflict_reviews")return {
    updateOne:async()=>ack,findOne:async()=>{reviewReads++;return null;}
   };
   throw Error("UNEXPECTED_COLLECTION");
  }};
  await assert.rejects(appendStockConflictReview({db,auth,conflictId,decisionId,
   action:"ACUSAR_RECIBO",note:"Revisión registrada por supervisor"}),{code:"OFFLINE_CONFLICT_REVIEW_WRITE_UNVERIFIED"});
  assert.equal(reviewReads,0,"Never read post-ack state after uncertain write");
 }
});
test("Capa 2: reintento confirmado sí verifica la decisión y sigue siendo idempotente",async()=>{
 let persisted;
 const db={collection(name){
  if(name==="gruk_offline_stock_conflicts")return {findOne:async()=>original};
  if(name==="gruk_offline_stock_conflict_reviews")return {
   updateOne:async(_key,patch)=>{
    if(persisted)return {acknowledged:true,upsertedCount:0};
    persisted=patch.$setOnInsert;
    return {acknowledged:true,upsertedCount:1};
   },
   findOne:async()=>persisted
  };
  throw Error("UNEXPECTED_COLLECTION");
 }};
 const args={db,auth,conflictId,decisionId,action:"ACUSAR_RECIBO",note:"Revisión registrada por supervisor"};
 const first=await appendStockConflictReview(args);
 const replay=await appendStockConflictReview(args);
 assert.deepEqual(replay,first);
 assert.equal(first.status,"REVISION_REGISTRADA");
 assert.equal(first.applied,false);assert.equal(first.cobrado,false);
});
