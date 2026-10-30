"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const context={empresaId:"empresa-A",sedeId:"sede-A",actorId:"actor-A"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FAV";
function outboxWith(quantity){
 const source=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-outbox.js"),"utf8");
 const record={eventId,syncStatus:"pending",serverApplied:false,event:{
  ...context,eventId,payload:{items:[{productoId:"sku1",cantidad:quantity}]}
 }};
 const cursorRequest={};
 const db={close(){},transaction(){return {objectStore(){return {openCursor(){
  queueMicrotask(()=>{
   cursorRequest.result={value:record,continue(){
    queueMicrotask(()=>{cursorRequest.result=null;cursorRequest.onsuccess?.();});
   }};
   cursorRequest.onsuccess?.();
  });
  return cursorRequest;
 }}};}}};
 const indexedDB={open(){const r={result:db};queueMicrotask(()=>r.onsuccess?.());return r;}};
 const module={exports:{}};
 const sandbox={module,indexedDB,Promise,Date,Error,JSON,IDBKeyRange:{}};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox);
 return module.exports;
}
test("Capa 2: no reserva cantidades no enteras, negativas, desbordadas o ambiguas",async()=>{
 for(const quantity of [0,-1,1.5,NaN,Infinity,-Infinity,
   "0","-1","1.5","1e4","1 "," 1","01","9007199254740992",{},[],true,null]){
   await assert.rejects(outboxWith(quantity).listStockReservations(context),
     /OUTBOX_STOCK_EVENT_INVALID/,String(quantity));
 }
});
test("Capa 2: permite unidades enteras seguras numéricas o decimales canónicas",async()=>{
 for(const quantity of [1,15,Number.MAX_SAFE_INTEGER,"1","15","9007199254740991"]){
   const result=await outboxWith(quantity).listStockReservations(context);
   assert.equal(result.length,1);
   assert.equal(result[0].cantidad,quantity);
 }
});
