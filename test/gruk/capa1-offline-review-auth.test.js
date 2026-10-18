"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {beginReview,findExpiredReviews}=require("../../core/offline/offlineReview.service");
const context={empresaId:"empresaA",sedeId:"sedeA",actorId:"reviewerA",canReview:true};
test("expired reviews fail closed when reviewer identity is missing or invalid",async()=>{
 let queries=0;
 const db={collection(){queries++;throw Error("MUST_NOT_QUERY");}};
 for(const bad of [null,{...context,actorId:undefined},{...context,actorId:""}, {...context,actorId:"another.$admin"},{...context,empresaId:""}, {...context,sedeId:"."},{...context,canReview:false}]){
  await assert.rejects(findExpiredReviews({db,context:bad}),/OFFLINE_AUTH_REQUIRED/);
 }
 assert.equal(queries,0);
});
test("expired reviews filter actor, tenant, status and lease with valid context",async()=>{
 let received;
 const now=new Date("2026-10-18T12:00:00.000Z");
 const db={collection(name){
  assert.equal(name,"gruk_offline_inbox");
  return {find(filter,options){
   received={filter,options};
   return {limit(n){assert.equal(n,50);return {async toArray(){return [{eventId:"evtA"}];}};}};
  }};
 }};
 const result=await findExpiredReviews({db,context,now});
 assert.deepEqual(result,[{eventId:"evtA"}]);
 assert.deepEqual(received.filter,{empresaId:context.empresaId,sedeId:context.sedeId,reviewActorId:context.actorId,status:"EN_REVISION",reviewLeaseUntil:{$lte:now}});
 assert.equal(received.options.projection._id,0);
});
test("beginReview rejects malformed event identifier before opening database",async()=>{
 let touched=false;
 const db={collection(){touched=true;throw Error("MUST_NOT_QUERY");}};
 await assert.rejects(beginReview({db,context,eventId:"$where"}),/OFFLINE_AUTH_REQUIRED/);
 assert.equal(touched,false);
});
