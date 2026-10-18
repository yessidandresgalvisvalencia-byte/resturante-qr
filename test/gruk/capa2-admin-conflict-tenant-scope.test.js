"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {listStockConflicts,appendStockConflictReview}=require("../../core/offline/offlineConflictAdmin.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",usuarioId:"admin",rol:"ADMIN_SEDE"};
const conflictId="offline-stock-"+"a".repeat(64),decisionId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const original={_id:conflictId,empresaId:auth.empresaId,sedeId:auth.sedeId,
 actorId:"operator",status:"REQUIERE_REVISION",applied:false,cobrado:false,
 issues:[{productoId:"507f1f77bcf86cd799439011",faltante:"1"}],eventIds:[decisionId]};
function fake({listRow=original,sourceRow=original,reviewPatch={}}={}){
 let writes=0;
 return {get writes(){return writes;},db:{collection(name){
  if(name==="gruk_offline_stock_conflicts")return {
   find(q,opts){assert.equal(q.empresaId,auth.empresaId);assert.equal(q.sedeId,auth.sedeId);
    assert.equal(opts.projection.empresaId,1);assert.equal(opts.projection.sedeId,1);
    return {async toArray(){return [listRow];}};
   },
   async findOne(q,opts){
    assert.equal(q.empresaId,auth.empresaId);assert.equal(q.sedeId,auth.sedeId);
    assert.equal(opts.projection.empresaId,1);assert.equal(opts.projection.sedeId,1);
    return sourceRow;
   }
  };
  if(name==="gruk_offline_stock_conflict_reviews")return {
   async updateOne(key,patch){writes++;this.record=patch.$setOnInsert;return {upsertedCount:1};},
   async findOne(q,opts){
    assert.equal(q.empresaId,auth.empresaId);assert.equal(q.sedeId,auth.sedeId);
    assert.equal(opts.projection.empresaId,1);assert.equal(opts.projection.sedeId,1);
    return {...this.record,...reviewPatch};
   }
  };
  throw Error("UNEXPECTED_COLLECTION");
 }}};
}
const request=db=>({db,auth,conflictId,decisionId,action:"ACUSAR_RECIBO",note:"Auditoría verificada"});
test("Capa 2: authorized conflict list and review remain functional",async()=>{
 const data=fake();
 const rows=await listStockConflicts({db:data.db,auth});
 assert.equal(rows.length,1);
 const review=await appendStockConflictReview(request(data.db));
 assert.equal(review.status,"REVISION_REGISTRADA");
 assert.equal(data.writes,1);
});
test("Capa 2: foreign conflict evidence fails entire admin list",async()=>{
 for(const patch of [{empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},{status:"OTRO"},
  {empresaId:undefined},{sedeId:undefined}]){
  await assert.rejects(listStockConflicts({
   db:fake({listRow:{...original,...patch}}).db,auth
  }),{code:"OFFLINE_CONFLICT_SCOPE_MISMATCH"});
 }
});
test("Capa 2: foreign or unverified source prevents review write",async()=>{
 for(const patch of [{empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},{_id:"offline-stock-"+"b".repeat(64)},
  {applied:true},{cobrado:true},{empresaId:undefined}]){
  const data=fake({sourceRow:{...original,...patch}});
  await assert.rejects(appendStockConflictReview(request(data.db)),{code:"OFFLINE_CONFLICT_NOT_FOUND"});
  assert.equal(data.writes,0);
 }
});
test("Capa 2: foreign persisted decision cannot attest idempotency",async()=>{
 for(const patch of [{empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},{empresaId:undefined},
  {_id:"01ARZ3NDEKTSV4RRFFQ69G5FA1"}]){
  const data=fake({reviewPatch:patch});
  await assert.rejects(appendStockConflictReview(request(data.db)),
   {code:"OFFLINE_CONFLICT_REVIEW_IDEMPOTENCY_CONFLICT"});
 }
});
