"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ctx={empresaId:"empresa-A",sedeId:"sede-A",actorId:"actor-A"};
function abortingIndexedDB(){
 const db={close(){db.closed=true;},closed:false,transaction(){
   const tx={error:new Error("DISK_READ_ABORT")};
   tx.objectStore=()=>({openCursor(){
     queueMicrotask(()=>tx.onabort?.());
     return {};
   }});
   return tx;
 }};
 return {db,indexedDB:{open(){
   const req={result:db};
   queueMicrotask(()=>req.onsuccess?.());
   return req;
 }}};
}
test("Capa 2: aborto al consultar stock offline rechaza y cierra IndexedDB",async()=>{
 const source=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-outbox.js"),"utf8");
 const {db,indexedDB}=abortingIndexedDB();
 const module={exports:{}};
 const sandbox={module,indexedDB,IDBKeyRange:{},Date,JSON,Promise,Error};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(source,sandbox,{filename:"gruk-offline-outbox.js"});
 await assert.rejects(module.exports.listStockReservations(ctx),/DISK_READ_ABORT/);
 assert.equal(db.closed,true);
});
