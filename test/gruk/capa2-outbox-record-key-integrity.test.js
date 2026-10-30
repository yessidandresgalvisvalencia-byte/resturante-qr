"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const tenant={empresaId:"empresa-A",sedeId:"sede-A",actorId:"actor-A"};
const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
function outboxFromRow(row){
 const source=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-outbox.js"),"utf8");
 let writes=0,closes=0;
 const store={
  index(){return {openCursor:()=>cursor()};},
  openCursor:()=>cursor(),
  get(){const req={result:structuredClone(row)};queueMicrotask(()=>req.onsuccess?.());return req;},
  put(){writes++;return {};}
 };
 function cursor(){
  const req={};let first=true;
  function next(){
   queueMicrotask(()=>{
    req.result=first?{value:structuredClone(row),continue:next}:null;
    first=false;req.onsuccess?.();
   });
  }
  next();return req;
 }
 const db={close(){closes++;},transaction(){
   const t={objectStore:()=>store};
   queueMicrotask(()=>queueMicrotask(()=>queueMicrotask(()=>t.oncomplete?.())));
   return t;
 }};
 const indexedDB={open(){
   const req={result:db};queueMicrotask(()=>req.onsuccess?.());return req;
 }};
 const module={exports:{}};
 const sandbox={module,indexedDB,IDBKeyRange:{only:x=>x},JSON,Date,Promise,Error};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox);
 return {outbox:module.exports,stats:()=>({writes,closes})};
}
const corrupt={eventId:ids[0],syncStatus:"pending",serverApplied:false,
 event:{...tenant,eventId:ids[1],payload:{items:[{productoId:"sku-1",cantidad:1}]}}};
test("Capa 2: ninguna consulta usa un evento cuya clave no corresponde a su ULID",async()=>{
 for(const op of [
  o=>o.listPending(10,tenant),
  o=>o.listLocal(10,tenant),
  o=>o.listStockReservations(tenant),
  o=>o.markReceived(ids[0],tenant)
 ]){
  const {outbox,stats}=outboxFromRow(corrupt);
  await assert.rejects(op(outbox),/OUTBOX_EVENT_ID_MISMATCH/);
  assert.equal(stats().writes,0);
 }
 const received={...corrupt,syncStatus:"received"};
 const {outbox,stats}=outboxFromRow(received);
 await assert.rejects(outbox.listReceived(10,tenant),/OUTBOX_EVENT_ID_MISMATCH/);
 await assert.rejects(outbox.markReconciled(ids[0],tenant,{
  eventId:ids[0],status:"PENDIENTE",applied:false,staged:false,financiallyReconciled:false
 }),/OUTBOX_EVENT_ID_MISMATCH/);
 assert.equal(stats().writes,0);
});
test("Capa 2: el evento y clave concordantes siguen listándose",async()=>{
 const valid={...corrupt,event:{...corrupt.event,eventId:ids[0]}};
 const {outbox}=outboxFromRow(valid);
 const pending=await outbox.listPending(10,tenant);
 assert.equal(pending.length,1);
 assert.equal(pending[0].eventId,ids[0]);
 const stock=await outbox.listStockReservations(tenant);
 assert.equal(stock.length,1);
});
