"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {markOfflineApplied}=require("../../core/offline/offlineApply.service");
const ctx={empresaId:"A",sedeId:"1",actorId:"user",canReview:true};
const eventId="evt1",reviewToken="12345678-1234-1234-1234-123456789abc";
const commitReference={collection:"gruk_ledger_movimientos",eventId};
function fixture(committed,{saleStatus="CONTABILIZADA",cashStatus="CONCILIADO",cashCobrado=true,saleAmount="3000",cashAmount="3000",ledgerAmount="3000"}={}){
  const record={empresaId:"A",sedeId:"1",eventId,actorId:"user",status:"EN_REVISION",reviewToken,reviewActorId:"user"};
  let changes=0,query;
  const db={collection(name){
    if(name==="gruk_offline_inbox") return {
      async findOne(q){return q.empresaId==="A"&&q.sedeId==="1"&&q.eventId===eventId&&q.reviewToken===reviewToken&&q.actorId===record.actorId&&q.reviewActorId===record.reviewActorId?record:null;},
      async updateOne(q,update){query=q;changes++;assert.equal(update.$set.status,"APLICADO");return {modifiedCount:1};}
    };
    if(name==="gruk_ledger_movimientos")return {async findOne(q){assert.equal(q.empresaId,"A");assert.equal(q.sedeId,"1");assert.equal(q.eventId,eventId);assert.equal(q.actorId,"user");return committed?{_id:"stored",eventId,montoCop:ledgerAmount}:null;}};
    if(name==="gruk_offline_ventas")return {async findOne(q){assert.equal(q.empresaId,"A");assert.equal(q.sedeId,"1");assert.equal(q.eventId,eventId);assert.equal(q.actorId,"user");return q.status===saleStatus?{totalCop:saleAmount}:null;}};
    if(name==="gruk_offline_caja_intenciones")return {async findOne(q){assert.equal(q.empresaId,"A");assert.equal(q.sedeId,"1");assert.equal(q.eventId,eventId);assert.equal(q.actorId,"user");return q.status===cashStatus&&q.cobrado===cashCobrado?{montoCop:cashAmount}:null;}};
    throw Error("unexpected collection");
  }};
  return {db,get changes(){return changes},get query(){return query}};
}
test("offline apply: cannot mark applied without durable ledger evidence",async()=>{
  const f=fixture(false);
  await assert.rejects(markOfflineApplied({db:f.db,context:ctx,eventId,reviewToken,commitReference}),/OFFLINE_DOMAIN_NOT_COMMITTED/);
  assert.equal(f.changes,0);
});
test("offline apply: caller boolean or unrecognized reference cannot forge proof",async()=>{
  const f=fixture(true);
  await assert.rejects(markOfflineApplied({db:f.db,context:ctx,eventId,reviewToken,commitReference:{...commitReference,collection:"ventas"},domainCommitted:true}),/OFFLINE_COMMIT_PROOF_REQUIRED/);
  assert.equal(f.changes,0);
});
test("offline apply: committed ledger reference is tenant and token scoped",async()=>{
  const f=fixture(true);
  const result=await markOfflineApplied({db:f.db,context:ctx,eventId,reviewToken,commitReference});
  assert.equal(result.status,"APLICADO");
  assert.equal(f.changes,1);
  assert.equal(f.query.reviewToken,reviewToken);
  assert.equal(f.query.actorId,"user");
  assert.equal(f.query.reviewActorId,"user");
  assert.equal(f.query.empresaId,"A");
  assert.equal(f.query.status,"EN_REVISION");
});
test("offline apply: reviewer permission required",async()=>{
  const f=fixture(true);
  await assert.rejects(markOfflineApplied({db:f.db,context:{...ctx,canReview:false},eventId,reviewToken,commitReference}),/OFFLINE_AUTH_REQUIRED/);
  assert.equal(f.changes,0);
});

test("offline apply: another operator cannot finalize claimed event",async()=>{
  const f=fixture(true);
  const result=await markOfflineApplied({
    db:f.db,context:{...ctx,actorId:"other"},eventId,reviewToken,commitReference
  });
  assert.equal(result.status,"NO_RECLAMADO");
  assert.equal(f.changes,0);
});

test("offline apply: ledger alone does not qualify as final commitment",async()=>{
 for(const opts of [
  {saleStatus:"PENDIENTE_CONTABILIZACION"},
  {cashStatus:"PENDIENTE_CONCILIACION"},
  {cashCobrado:false},
  {saleAmount:"2999"},
  {cashAmount:"2999"},
  {ledgerAmount:"2999"},
  {cashAmount:"3000.0"}
 ]){
  const f=fixture(true,opts);
  await assert.rejects(markOfflineApplied({db:f.db,context:ctx,eventId,reviewToken,commitReference}),/OFFLINE_DOMAIN_NOT_COMMITTED/);
  assert.equal(f.changes,0);
 }
});
