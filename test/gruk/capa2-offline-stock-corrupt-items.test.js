"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const context={empresaId:"empresa-A",sedeId:"sede-A",actorId:"actor-A"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FAV";
function outboxWith(items){
 const source=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-outbox.js"),"utf8");
 const record={eventId,syncStatus:"pending",serverApplied:false,event:{
  ...context,eventId,payload:{items}
 }};
 const request={};
 const db={close(){},transaction(){
  return {objectStore(){return {openCursor(){
   queueMicrotask(()=>{request.result={value:record,continue(){
    queueMicrotask(()=>{request.result=null;request.onsuccess?.();});
   }};request.onsuccess?.();});
   return request;
  }};}};
 }};
 const indexedDB={open(){const r={result:db};queueMicrotask(()=>r.onsuccess?.());return r;}};
 const module={exports:{}};
 const sandbox={module,indexedDB,Promise,Date,Error,JSON,IDBKeyRange:{}};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox);
 return module.exports;
}
test("Capa 2: ítem corrupto nunca genera reserva parcial",async()=>{
 for(const invalid of [null,undefined,[],{},{"productoId":""},
  {"productoId":"sku1"},{"productoId":"sku1","cantidad":null},
  {"productoId":1,"cantidad":1}]){
  const outbox=outboxWith([{productoId:"sku-valid",cantidad:1},invalid]);
  await assert.rejects(outbox.listStockReservations(context),/OUTBOX_STOCK_EVENT_INVALID/);
 }
});
test("Capa 2: reserva válida sigue siendo visible",async()=>{
 const outbox=outboxWith([{productoId:"sku1",cantidad:1}]);
 const result=await outbox.listStockReservations(context);
 assert.equal(result.length,1);
 assert.equal(result[0].productoId,"sku1");
 assert.equal(result[0].cantidad,1);
});
