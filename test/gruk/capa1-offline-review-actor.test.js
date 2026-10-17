"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {beginReview,findExpiredReviews}=require("../../core/offline/offlineReview.service");
const context={empresaId:"A",sedeId:"S",actorId:"u1",canReview:true};
test("review claim scoped to event owner",async()=>{
 let key;
 const db={collection:()=>({findOne:async q=>{key=q;return null;}})};
 const result=await beginReview({db,context,eventId:"evt"});
 assert.equal(result.status,"NO_PENDIENTE");
 assert.equal(key.actorId,"u1");
});
test("expired reviews scoped to original reviewer",async()=>{
 let query;
 const db={collection:()=>({find:q=>{query=q;return {limit:()=>({toArray:async()=>[]})};}})};
 await findExpiredReviews({db,context});
 assert.equal(query.reviewActorId,"u1");
});
