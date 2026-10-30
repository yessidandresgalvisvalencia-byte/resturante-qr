"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const context={empresaId:"empresa-A",sedeId:"sede-A",actorId:"actor-A"};
const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
function outboxWith(records){
 const source=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-outbox.js"),"utf8");
 const request={};
 const store={openCursor(){
  let offset=0;
  function next(){
   queueMicrotask(()=>{
    request.result=offset<records.length?{value:records[offset++],continue:next}:null;
    request.onsuccess?.();
   });
  }
  next();
  return request;
 }};
 const db={close(){},transaction(){return {objectStore:()=>store};}};
 const indexedDB={open(){
  const request={result:db};
  queueMicrotask(()=>request.onsuccess?.());
  return request;
 }};
 const module={exports:{}};
 const sandbox={module,indexedDB,Promise,Error,Date,JSON};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox);
 return module.exports;
}
function record(eventId,productoId,cantidad,tenant=context){
 return {eventId,syncStatus:"pending",serverApplied:false,event:{
  ...tenant,eventId,payload:{items:[{productoId,cantidad}]}
 }};
}
test("Capa 2: suma de pedidos offline del mismo producto no puede desbordarse",async()=>{
 const orders=[
  record(ids[0],"sku1",String(Number.MAX_SAFE_INTEGER)),
  record(ids[1],"sku1",1)
 ];
 await assert.rejects(outboxWith(orders).listStockReservations(context),
  /OUTBOX_STOCK_QUANTITY_OVERFLOW/);
});
test("Capa 2: cantidades seguras se conservan con sus ids originales",async()=>{
 const orders=[record(ids[0],"sku1","4"),record(ids[1],"sku1",3)];
 const reservations=await outboxWith(orders).listStockReservations(context);
 assert.equal(reservations.length,2);
 assert.deepEqual(Array.from(reservations,x=>x.cantidad),["4",3]);
 assert.deepEqual(Array.from(reservations,x=>x.eventId),ids);
});
test("Capa 2: acumular reservas por producto, no entre productos ni empresas",async()=>{
 const orders=[
  record(ids[0],"sku1",Number.MAX_SAFE_INTEGER),
  record(ids[1],"sku2",Number.MAX_SAFE_INTEGER),
  record(ids[1],"sku1",1,{...context,empresaId:"empresa-B"})
 ];
 const reservations=await outboxWith(orders).listStockReservations(context);
 assert.equal(reservations.length,2);
});
