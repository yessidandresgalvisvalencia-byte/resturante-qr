"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ctx={empresaId:"empresa-A",sedeId:"sede-A",actorId:"actor-A"};
function loadAbortingOutbox(){
 const source=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-outbox.js"),"utf8");
 let closes=0;
 const db={
  close(){closes++;},
  transaction(){
   const tx={error:new Error("READ_TRANSACTION_ABORT")};
   tx.objectStore=()=>({
    index:()=>({openCursor:()=>{
     queueMicrotask(()=>tx.onabort?.());
     return {};
    }}),
    openCursor:()=>{
     queueMicrotask(()=>tx.onabort?.());
     return {};
    }
   });
   return tx;
  }
 };
 const indexedDB={open(){
   const req={result:db};
   queueMicrotask(()=>req.onsuccess?.());
   return req;
 }};
 const module={exports:{}};
 const sandbox={module,indexedDB,IDBKeyRange:{only:x=>x},Promise,Error,Date,JSON};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox);
 return {outbox:module.exports,closes:()=>closes};
}
for(const method of ["listPending","listReceived","listLocal"]){
 test("Capa 2: "+method+" rechaza transacción abortada y cierra base",async()=>{
  const {outbox,closes}=loadAbortingOutbox();
  await assert.rejects(outbox[method](10,ctx),/READ_TRANSACTION_ABORT/);
  assert.equal(closes(),1);
 });
}
