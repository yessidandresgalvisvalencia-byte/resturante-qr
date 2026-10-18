"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {stageOfflineCashIntents:stage}=require("../../core/offline/offlineCashStaging.service");
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const context={empresaId:"empresa",sedeId:"sede",actorId:"cajero"};
const plan={orders:[{eventId:id,totalCop:"3000"}],totalCop:"3000"};
function fixture(indexReady=true){
 const rows=new Map(),session={inTransaction:()=>true};
 const db={collection(name){assert.equal(name,"gruk_offline_caja_intenciones");return{
  indexes:async()=>indexReady?[{name:"uniq_offline_cash_tenant_event",unique:true,key:{empresaId:1,sedeId:1,eventId:1}}]:[],
  updateOne:async(key,update,opts)=>{assert.equal(opts.session,session);if(rows.has(key.eventId))return {upsertedCount:0};rows.set(key.eventId,update.$setOnInsert);return {upsertedCount:1};},
  findOne:async key=>rows.get(key.eventId)
 };}};return {db,session,rows};
}
test("intención caja offline no cobra y reintento no duplica",async()=>{
 const f=fixture();const one=await stage({...f,context,plan});const retry=await stage({...f,context,plan});
 assert.equal(one.records[0].inserted,true);assert.equal(retry.records[0].inserted,false);
 assert.equal(f.rows.size,1);assert.equal(f.rows.get(id).cobrado,false);
});
test("importe divergente es conflicto, no se registra segundo",async()=>{
 const f=fixture();await stage({...f,context,plan});
 await assert.rejects(stage({...f,context,plan:{orders:[{eventId:id,totalCop:"4000"}],totalCop:"4000"}}),
 e=>e.code==="OFFLINE_CASH_REPLAY_CONFLICT");assert.equal(f.rows.size,1);
});
test("sin índice único no permite registrar caja",async()=>{
 const f=fixture(false);await assert.rejects(stage({...f,context,plan}),e=>e.code==="OFFLINE_CASH_UNIQUE_INDEX_REQUIRED");
 assert.equal(f.rows.size,0);
});
