"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ctx={empresaId:"empresaA",sedeId:"sedeA",actorId:"operadorA"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FAV";
function harness(records){
 const source=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-outbox.js"),"utf8");
 const request={};
 const store={openCursor(){
   let i=0;
   function next(){
     queueMicrotask(()=>{
       request.result=i<records.length?{value:records[i++],continue:next}:null;
       request.onsuccess?.();
     });
   }
   next();return request;
 }};
 const db={transaction(){return {objectStore:()=>store};},close(){}};
 const indexedDB={open(){const r={result:db};queueMicrotask(()=>r.onsuccess?.());return r;}};
 const module={exports:{}};
 const sandbox={module,indexedDB,Promise,Error,Date,JSON,IDBKeyRange:{}};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox);
 return module.exports;
}
const record=(status,staged,applied,override={})=>({
 eventId,syncStatus:status,serverStaged:staged,serverApplied:applied,
 event:{...ctx,eventId,payload:{items:[{productoId:"sku1",cantidad:"1"}]}},
 ...override
});
test("Capa 2: preparado en servidor no libera reserva si inventario aún no aplicado",async()=>{
 const outbox=harness([record("received",true,false)]);
 const reservations=await outbox.listStockReservations(ctx);
 assert.equal(reservations.length,1);
 assert.equal(reservations[0].eventId,eventId);
 assert.equal(reservations[0].productoId,"sku1");
});
test("Capa 2: aplicado deja de reservar; pending conserva reserva",async()=>{
 const applied=await harness([record("received",true,true)]).listStockReservations(ctx);
 const pending=await harness([record("pending",false,false)]).listStockReservations(ctx);
 assert.equal(applied.length,0);
 assert.equal(pending.length,1);
});
test("Capa 2: nunca lista reservas de otra empresa ni otro actor",async()=>{
 const records=[record("received",true,false,{event:{...ctx,empresaId:"empresaB",payload:{items:[{productoId:"sku1",cantidad:"1"}]}}}),
  record("received",true,false,{event:{...ctx,actorId:"otro",payload:{items:[{productoId:"sku1",cantidad:"1"}]}}})];
 assert.equal((await harness(records).listStockReservations(ctx)).length,0);
});
