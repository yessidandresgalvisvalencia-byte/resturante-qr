"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {beginReview}=require("../../core/offline/offlineReview.service");
const data={empresaId:"A",sedeId:"1",eventId:"evt",status:"PENDIENTE"};
test("offline review: requires reviewer permission",async()=>{
 const db={collection:()=>({findOne:async()=>data,updateOne:async()=>{throw Error("must not write");}})};
 await assert.rejects(beginReview({db,context:{empresaId:"A",sedeId:"1",actorId:"u",canReview:false},eventId:"evt"}),/OFFLINE_PERMISSION_DENIED/);
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
