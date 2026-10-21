"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {listStockConflicts,appendStockConflictReview}=require("../../core/offline/offlineConflictAdmin.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",usuarioId:"admin",rol:"ADMIN_SEDE"};
const conflictId="offline-stock-"+"a".repeat(64);
const decisionId="01ARZ3NDEKTSV4RRFFQ69G5FA0",eventId="01ARZ3NDEKTSV4RRFFQ69G5FA1";
const issue={productoId:"507f1f77bcf86cd799439011",disponible:"0",solicitado:"2",faltante:"2"};
const valid={_id:conflictId,empresaId:auth.empresaId,sedeId:auth.sedeId,actorId:"operator",
 status:"REQUIERE_REVISION",applied:false,cobrado:false,eventIds:[eventId],issues:[issue]};
function fixture(rows){
 let reads=0,writes=0;
 const db={collection(name){
  if(name==="gruk_offline_stock_conflicts")return {
   find(filter,options){reads++;assert.equal(filter.empresaId,auth.empresaId);
    assert.equal(filter.sedeId,auth.sedeId);assert.equal(options.limit,1);
    return {toArray:async()=>rows};},
   async findOne(filter){reads++;assert.equal(filter.empresaId,auth.empresaId);
    assert.equal(filter.sedeId,auth.sedeId);return rows?.[0]??null;}
  };
  if(name==="gruk_offline_stock_conflict_reviews")return {
   async updateOne(){writes++;throw Error("FORBIDDEN_REVIEW_WRITE");}
  };
  throw Error("FORBIDDEN_COLLECTION");
 }};
 return {db,get reads(){return reads;},get writes(){return writes;}};
}
test("Capa 2: rechazo cerrado de array disperso y exceso de resultados",async()=>{
 for(const rows of [new Array(1),[valid,valid]]){
  const f=fixture(rows);
  await assert.rejects(listStockConflicts({db:f.db,auth,limit:1}),
    {code:"OFFLINE_CONFLICT_SCOPE_MISMATCH"});
  assert.equal(f.reads,1);assert.equal(f.writes,0);
 }
});
test("Capa 2: cantidad histórica gigantesca nunca se lista ni aprueba",async()=>{
 for(const field of ["disponible","solicitado","faltante"]){
  const f=fixture([{...valid,issues:[{...issue,[field]:"9".repeat(100000)}]}]);
  await assert.rejects(listStockConflicts({db:f.db,auth,limit:1}),
   {code:"OFFLINE_CONFLICT_SCOPE_MISMATCH"});
  await assert.rejects(appendStockConflictReview({
   db:f.db,auth,conflictId,decisionId,action:"ACUSAR_RECIBO",note:"Faltante revisado manualmente"
  }),{code:"OFFLINE_CONFLICT_NOT_FOUND"});
  assert.equal(f.writes,0);
 }
});
test("Capa 2: evidencia válida continúa visible para administrador de su sede",async()=>{
 const f=fixture([valid]);
 const rows=await listStockConflicts({db:f.db,auth,limit:1});
 assert.equal(rows.length,1);
 assert.equal(rows[0].conflictId,conflictId);
 assert.deepEqual(rows[0].issues,[issue]);
});
