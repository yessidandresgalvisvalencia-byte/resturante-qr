"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {listStockConflicts,appendStockConflictReview}=require("../../core/offline/offlineConflictAdmin.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",usuarioId:"admin",rol:"ADMIN_SEDE"};
const conflictId="offline-stock-"+"a".repeat(64),decisionId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const action="ACUSAR_RECIBO",note="Revision de sobrantes y faltantes";
function forbiddenDB(){
 let accesses=0;
 return {db:{collection(){accesses++;throw Error("UNAUTHORIZED_QUERY");}},get accesses(){return accesses;}};
}
test("Capa 2: empresa o sede como objeto, aun convertible al ID, se rechaza ANTES de Mongo",async()=>{
 for(const field of ["empresaId","sedeId"]){
  for(const value of [
   {$ne:null}, {$eq:auth[field]}, {toString:()=>auth[field]},
   new String(auth[field]),[auth[field]],{valueOf:()=>auth[field]}
  ]){
   const f=forbiddenDB(),bad={...auth,[field]:value};
   await assert.rejects(listStockConflicts({db:f.db,auth:bad}),
     {code:"OFFLINE_CONFLICT_PERMISSION_DENIED"});
   await assert.rejects(appendStockConflictReview({
    db:f.db,auth:bad,conflictId,decisionId,action,note
   }),{code:"OFFLINE_CONFLICT_PERMISSION_DENIED"});
   assert.equal(f.accesses,0);
  }
 }
});
test("Capa 2: conflicto y decisionId no aceptan objetos que aparenten ser cadenas",async()=>{
 for(const field of ["conflictId","decisionId"]){
  const original=field==="conflictId"?conflictId:decisionId;
  for(const bad of [{$eq:original},[original],{toString:()=>original},new String(original)]){
   const f=forbiddenDB();
   await assert.rejects(appendStockConflictReview({
    db:f.db,auth,conflictId,decisionId,action,note,[field]:bad
   }),{code:"OFFLINE_CONFLICT_REVIEW_INVALID"});
   assert.equal(f.accesses,0);
  }
 }
});
test("Capa 2: identificadores de tipo string siguen consultando solo su tenant",async()=>{
 let reads=0;
 const db={collection(name){
  assert.equal(name,"gruk_offline_stock_conflicts");
  return {find(query,options){
   reads++;
   assert.equal(query.empresaId,auth.empresaId);
   assert.equal(query.sedeId,auth.sedeId);
   assert.equal(query.status,"REQUIERE_REVISION");
   assert.equal(options.limit,1);
   return {toArray:async()=>[]};
  }};
 }};
 assert.deepEqual(await listStockConflicts({db,auth,limit:1}),[]);
 assert.equal(reads,1);
});
