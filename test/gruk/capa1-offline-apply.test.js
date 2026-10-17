"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {markOfflineApplied}=require("../../core/offline/offlineApply.service");
const ctx={empresaId:"A",sedeId:"1",actorId:"user",canReview:true};
const eventId="evt1",reviewToken="12345678-1234-1234-1234-123456789abc";
const commitReference={collection:"gruk_ledger_movimientos",eventId};
function fixture(committed){
  const record={empresaId:"A",sedeId:"1",eventId,status:"EN_REVISION",reviewToken};
  let changes=0,query;
  const db={collection(name){
    if(name==="gruk_offline_inbox") return {
      async findOne(q){return q.empresaId==="A"&&q.sedeId==="1"&&q.eventId===eventId&&q.reviewToken===reviewToken?record:null;},
      async updateOne(q,update){query=q;changes++;assert.equal(update.$set.status,"APLICADO");return {modifiedCount:1};}
    };
    if(name==="gruk_ledger_movimientos")return {async findOne(q){assert.equal(q.empresaId,"A");assert.equal(q.sedeId,"1");assert.equal(q.eventId,eventId);return committed?{_id:"stored",eventId}:null;}};
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
  assert.equal(f.query.empresaId,"A");
  assert.equal(f.query.status,"EN_REVISION");
});
test("offline apply: reviewer permission required",async()=>{
  const f=fixture(true);
  await assert.rejects(markOfflineApplied({db:f.db,context:{...ctx,canReview:false},eventId,reviewToken,commitReference}),/OFFLINE_AUTH_REQUIRED/);
  assert.equal(f.changes,0);
});
