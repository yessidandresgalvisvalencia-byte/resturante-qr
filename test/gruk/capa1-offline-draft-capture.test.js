"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {newUlid,createOfflineOrder,saveOfflineOrder}=require("../../public/js/gruk-offline-draft");
const {validateBatch}=require("../../core/offline/offlineBatch.contract");
const {validateOfflineOrderForPosting}=require("../../core/offline/offlineOrderPosting.contract");
const cryptoSource={getRandomValues(bytes){for(let i=0;i<bytes.length;i++)bytes[i]=i;return bytes;}};
const ctx={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"operator"};
const input={context:ctx,deviceId:"device_1",productoId:"507f1f77bcf86cd799439011",
 cantidad:"2",precioUnitarioCop:"3000",now:new Date("2026-10-18T16:00:00.000Z"),cryptoSource};
test("draft: offline event strictly matches durable inbox and posting validation",()=>{
 const event=createOfflineOrder(input);
 assert.match(event.eventId,/^[0-9A-HJKMNP-TV-Z]{26}$/);
 assert.equal(event.payload.localOrderId,event.eventId);
 assert.equal(event.payload.totalCop,"6000");
 assert.equal(validateBatch([event],ctx).length,1);
 const plan=validateOfflineOrderForPosting(event);
 assert.equal(plan.totalCop,"6000");
 assert.equal(plan.items[0].productoId,input.productoId);
});
test("draft: no money floats, overflow, negative quantities or unsafe products",()=>{
 for(const candidate of [
  {precioUnitarioCop:"2.5"},{precioUnitarioCop:"-1"},{precioUnitarioCop:"1e9"},
  {cantidad:"0"},{cantidad:"2.1"},{cantidad:"1001"},
  {productoId:"$ne"},{productoId:"0".repeat(23)},
  {precioUnitarioCop:"9007199254740991",cantidad:"2"},
  {context:{...ctx,empresaId:"$where"}}
 ])assert.throws(()=>createOfflineOrder({...input,...candidate}),/OFFLINE_DRAFT/);
});
test("draft: must cryptographically generate ULID, and no unsecure random fallback",()=>{
 assert.equal(newUlid(input.now.getTime(),cryptoSource).length,26);
 assert.throws(()=>newUlid(123,null),/OFFLINE_CRYPTO_REQUIRED/);
});
test("draft: never reports saved until IndexedDB outbox putPending resolves",async()=>{
 let captured,ack=false;
 const outbox={async putPending(event){captured=event;ack=true;return event.eventId;}};
 const result=await saveOfflineOrder({outbox,...input});
 assert.equal(ack,true);
 assert.equal(result.eventId,captured.eventId);
 assert.equal(result.status,"pending");
 assert.equal(result.totalCop,"6000");
 await assert.rejects(saveOfflineOrder({outbox:{putPending:async()=>{throw Error("QUOTA_EXCEEDED");}},...input}),
  /QUOTA_EXCEEDED/);
 await assert.rejects(saveOfflineOrder({outbox:{putPending:async()=>false},...input}),
  /OFFLINE_DRAFT_SAVE_FAILED/);
});
