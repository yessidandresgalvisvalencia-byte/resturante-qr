"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const tenant={empresaId:"empresa-A",sedeId:"sede-A",actorId:"actor-A"};
const id="01ARZ3NDEKTSV4RRFFQ69G5FAV";
function outboxWithMutation(context){
 const source=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-outbox.js"),"utf8");
 const record={eventId:id,syncStatus:"pending",serverApplied:false,event:{
  ...tenant,eventId:id,payload:{items:[{productoId:"sku-A",cantidad:1}]}
 }};
 const store={
  index(){return {openCursor:()=>cursor()};},
  openCursor:()=>cursor()
 };
 function cursor(){
  const request={};
  queueMicrotask(()=>{
   // Simulate account switching after local DB open but before cursor read.
   context.empresaId="empresa-B";
   request.result={value:record,continue(){
    queueMicrotask(()=>{request.result=null;request.onsuccess?.();});
   }};
   request.onsuccess?.();
  });
  return request;
 }
 let closes=0;
 const db={close(){closes++;},transaction(){return {objectStore:()=>store};}};
 const indexedDB={open(){
  const request={result:db};queueMicrotask(()=>request.onsuccess?.());return request;
 }};
 const module={exports:{}};
 const sandbox={module,indexedDB,IDBKeyRange:{only:x=>x},Date,Promise,JSON,Error};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox);
 return {outbox:module.exports,closed:()=>closes};
}
for(const method of ["listPending","listReceived","listLocal","listStockReservations"]){
 test("Capa 2: "+method+" no devuelve datos tras cambiar empresa durante lectura",async()=>{
  const context={...tenant};
  const {outbox,closed}=outboxWithMutation(context);
  const invoke=method==="listStockReservations"
   ?outbox[method](context):outbox[method](10,context);
  await assert.rejects(invoke,/OUTBOX_SESSION_CHANGED/);
  assert.equal(closed(),1);
 });
}
