"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const id="01ARZ3NDEKTSV4RRFFQ69G5FAV";
const secondId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
const identity={empresaId:"empresa-A",sedeId:"sede-A",actorId:"actor-A"};

function fakeIndexedDB({record,onOpen=()=>{},onRead=()=>{}}={}) {
 const writes=[];let closed=0,aborted=0;
 const db={
  close(){closed++;},
  transaction(){
   const tx={error:null,aborted:false};
   tx.abort=()=>{
    if(tx.aborted)return;
    tx.aborted=true;aborted++;
    queueMicrotask(()=>tx.onabort?.());
   };
   const store={
    get(eventId){
     assert.equal(eventId,id);
     const req={result:record?JSON.parse(JSON.stringify(record)):null};
     queueMicrotask(()=>{
      onRead();
      req.onsuccess?.();
      if(!tx.aborted&&writes.length===0)queueMicrotask(()=>tx.oncomplete?.());
     });
     return req;
    },
    put(row){
     writes.push(JSON.parse(JSON.stringify(row)));
     queueMicrotask(()=>{if(!tx.aborted)tx.oncomplete?.();});
    },
    add(row){
     writes.push(JSON.parse(JSON.stringify(row)));
     queueMicrotask(()=>{if(!tx.aborted)tx.oncomplete?.();});
    }
   };
   tx.objectStore=()=>store;
   return tx;
  }
 };
 const indexedDB={open(){
  const req={result:db};
  queueMicrotask(()=>{onOpen();req.onsuccess?.();});
  return req;
 }};
 const source=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-outbox.js"),"utf8");
 const module={exports:{}};
 const sandbox={module,indexedDB,Date,Promise,Error,JSON,Map,Number,Object,Array};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox);
 return {outbox:module.exports,writes,stats:()=>({closed,aborted})};
}
function row(syncStatus){
 return {eventId:id,syncStatus,event:{...identity,eventId:id,payload:{items:[{productoId:"sku-A",cantidad:1}]}}};
}
const proof=()=>({eventId:id,status:"APLICADO",applied:true,staged:true,financiallyReconciled:true});

for(const field of ["empresaId","sedeId","actorId"]){
 test("Capa 2: markReceived aborta si cambia "+field+" durante get()",async()=>{
  const ctx={...identity};
  const f=fakeIndexedDB({record:row("pending"),onRead:()=>{ctx[field]="otro";}});
  await assert.rejects(f.outbox.markReceived(id,ctx),/OUTBOX_SESSION_CHANGED/);
  assert.equal(f.writes.length,0);
  assert.deepEqual(f.stats(),{closed:1,aborted:1});
 });
 test("Capa 2: markReconciled aborta si cambia "+field+" durante get()",async()=>{
  const ctx={...identity};
  const f=fakeIndexedDB({record:row("received"),onRead:()=>{ctx[field]="otro";}});
  await assert.rejects(f.outbox.markReconciled(id,ctx,proof()),/OUTBOX_SESSION_CHANGED/);
  assert.equal(f.writes.length,0);
  assert.deepEqual(f.stats(),{closed:1,aborted:1});
 });
}
test("Capa 2: ACK normal mantiene el evento y cierra transacción",async()=>{
 const f=fakeIndexedDB({record:row("pending")});
 assert.equal(await f.outbox.markReceived(id,{...identity}),true);
 assert.equal(f.writes.length,1);
 assert.equal(f.writes[0].syncStatus,"received");
 assert.deepEqual(f.stats(),{closed:1,aborted:0});
});
test("Capa 2: conciliación guarda snapshot validado, no mutación posterior",async()=>{
 const result=proof();
 const f=fakeIndexedDB({record:row("received"),onRead:()=>{
  result.status="RECHAZADO";result.applied=false;
  result.staged=false;result.financiallyReconciled=false;
 }});
 assert.equal(await f.outbox.markReconciled(id,{...identity},result),true);
 assert.equal(f.writes.length,1);
 assert.equal(f.writes[0].serverStatus,"APLICADO");
 assert.equal(f.writes[0].serverApplied,true);
 assert.equal(f.writes[0].serverFinanciallyReconciled,true);
 assert.deepEqual(f.stats(),{closed:1,aborted:0});
});
test("Capa 2: putPending devuelve ULID persistido aunque cambie objeto original",async()=>{
 const event={...identity,eventId:id,payload:{items:[{productoId:"sku-A",cantidad:1}]}};
 const f=fakeIndexedDB({onOpen:()=>{event.eventId=secondId;event.empresaId="empresa-B";}});
 assert.equal(await f.outbox.putPending(event),id);
 assert.equal(f.writes.length,1);
 assert.equal(f.writes[0].eventId,id);
 assert.equal(f.writes[0].event.empresaId,"empresa-A");
 assert.deepEqual(f.stats(),{closed:1,aborted:0});
});
