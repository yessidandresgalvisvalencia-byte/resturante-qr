"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {beginReview,findExpiredReviews}=require("../../core/offline/offlineReview.service");
const data={empresaId:"A",sedeId:"1",eventId:"evt",status:"PENDIENTE"};
test("offline review: requires reviewer permission",async()=>{
 const db={collection:()=>({findOne:async()=>data,updateOne:async()=>{throw Error("must not write");}})};
 await assert.rejects(beginReview({db,context:{empresaId:"A",sedeId:"1",actorId:"u",canReview:false},eventId:"evt"}),/OFFLINE_AUTH_REQUIRED/);
});
test("offline review: conditional update detects concurrent workers",async()=>{
 let filter;
 const db={collection:()=>({findOne:async()=>data,updateOne:async(f)=>{filter=f;return {modifiedCount:0};}})};
 const result=await beginReview({db,context:{empresaId:"A",sedeId:"1",actorId:"u",canReview:true},eventId:"evt"});
 assert.equal(result.status,"CONFLICTO_CONCURRENCIA");assert.equal(filter.status,"PENDIENTE");
});
test("offline review: cannot review another tenant",async()=>{
 const db={collection:()=>({findOne:async()=>({...data,empresaId:"B"}),updateOne:async()=>{throw Error("must not write");}})};
 await assert.rejects(beginReview({db,context:{empresaId:"A",sedeId:"1",actorId:"u",canReview:true},eventId:"evt"}),/OFFLINE_TENANT_MISMATCH/);
});

test("offline review: lease expires but operations are not automatically replayed",async()=>{
 let update;
 const db={collection:()=>({findOne:async()=>data,updateOne:async(key,operation)=>{update=operation;return {modifiedCount:1};}})};
 const now=new Date("2026-10-17T12:00:00Z");
 const result=await beginReview({db,context:{empresaId:"A",sedeId:"1",actorId:"u",canReview:true},eventId:"evt",now});
 assert.equal(result.status,"EN_REVISION");
 assert.match(result.reviewToken,/^[0-9a-f-]{36}$/);
 assert.equal(update.$set.reviewLeaseUntil.toISOString(),"2026-10-17T12:01:00.000Z");
});
test("offline review: expired reviews stay under investigation, scoped to tenant",async()=>{
 let query,options,limit;
 const coll={find(q,o){query=q;options=o;return {limit(n){limit=n;return {toArray:async()=>[{eventId:"evt"}]};}};}};
 const db={collection:()=>coll};
 const result=await findExpiredReviews({db,context:{empresaId:"A",sedeId:"1",canReview:true},now:new Date("2026-10-17T13:00:00Z")});
 assert.deepEqual(result,[{eventId:"evt"}]);
 assert.equal(query.empresaId,"A");assert.equal(query.sedeId,"1");assert.equal(query.status,"EN_REVISION");
 assert.equal(options.projection._id,0);assert.equal(limit,50);
});
