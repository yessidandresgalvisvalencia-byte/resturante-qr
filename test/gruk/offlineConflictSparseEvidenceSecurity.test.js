"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {listStockConflicts,appendStockConflictReview}=require("../../core/offline/offlineConflictAdmin.service");
const {retryOfflineConflict}=require("../../core/offline/offlineConflictRetry.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",usuarioId:"admin",rol:"ADMIN_SEDE"};
const conflictId="offline-stock-"+"a".repeat(64),eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const original={_id:conflictId,empresaId:auth.empresaId,sedeId:auth.sedeId,
 status:"REQUIERE_REVISION",applied:false,cobrado:false,actorId:"operator",
 eventIds:[eventId],issues:[{productoId:"507f1f77bcf86cd799439011",disponible:"0",solicitado:"1",faltante:"1"}]};
const sparse=()=>{const a=[eventId,eventId];delete a[1];return a;};
const reviewArgs=db=>({db,auth,conflictId,decisionId:"01ARZ3NDEKTSV4RRFFQ69G5FA1",
 action:"ACUSAR_RECIBO",note:"Revisión de inventario pendiente"});
test("Capa 2: listado y revisión rechazan identificadores dispersos sin escrituras",async()=>{
 for(const doc of [{...original,eventIds:sparse()},{...original,issues:[,original.issues[0]]}]){
  let writes=0;
  const db={collection(name){
   if(name==="gruk_offline_stock_conflicts")return{
    find:()=>({toArray:async()=>[doc]}),findOne:async()=>doc};
   if(name==="gruk_offline_stock_conflict_reviews")return{
    updateOne:async()=>{writes++;throw Error("UNEXPECTED_WRITE");}};
   throw Error("UNEXPECTED_COLLECTION");
  }};
  await assert.rejects(listStockConflicts({db,auth}),{code:"OFFLINE_CONFLICT_SCOPE_MISMATCH"});
  await assert.rejects(appendStockConflictReview(reviewArgs(db)),{code:"OFFLINE_CONFLICT_NOT_FOUND"});
  assert.equal(writes,0);
 }
});
test("Capa 2: reintento no abre resolución ni transacción con IDs dispersos",async()=>{
 let resolutionReads=0,sessionStarts=0;
 const doc={...original,eventIds:sparse()};
 const db={client:{startSession(){sessionStarts++;throw Error("SHOULD_NOT_START");}},
  collection(name){
   if(name==="gruk_offline_stock_conflicts")return{findOne:async()=>doc};
   if(name==="gruk_offline_stock_resolutions")return{findOne:async()=>{resolutionReads++;return null;}};
   throw Error("UNEXPECTED_COLLECTION");
  }};
 await assert.rejects(retryOfflineConflict({db,auth,conflictId,confirmed:true,
  note:"Reintento bajo supervisión administrativa"}),{code:"OFFLINE_CONFLICT_RETRY_SOURCE_INVALID"});
 assert.equal(resolutionReads,0);
 assert.equal(sessionStarts,0);
});
