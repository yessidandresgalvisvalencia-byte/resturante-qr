"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ctx={empresaId:"empresa-A",sedeId:"sede-A",actorId:"actor-A"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FAV";

function withAbortingDb() {
  const source=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-outbox.js"),"utf8");
  let closed=0, writes=0;
  const db={
    transaction(){
      const transaction={error:null};
      const store={
        get(id){
          assert.equal(id,eventId);
          const request={result:{eventId,syncStatus:"pending",event:{eventId,...ctx}}};
          queueMicrotask(()=>request.onsuccess?.());
          return request;
        },
        put(record){
          writes++;
          assert.equal(record.syncStatus,"received");
          // A real IDB transaction can abort after a request's success.
          queueMicrotask(()=>transaction.onabort?.());
        }
      };
      transaction.objectStore=()=>store;
      return transaction;
    },
    close(){closed++;}
  };
  const indexedDB={open(){
    const request={result:db};
    queueMicrotask(()=>request.onsuccess?.());
    return request;
  }};
  const module={exports:{}};
  const sandbox={module,indexedDB,Date,Promise,Error,JSON,IDBKeyRange:{}};
  sandbox.globalThis=sandbox;
  vm.runInNewContext(source,sandbox);
  return {outbox:module.exports,stats:()=>({closed,writes})};
}
test("Capa 2: un aborto IndexedDB rechaza ACK y libera conexión",async()=>{
 const {outbox,stats}=withAbortingDb();
 await assert.rejects(outbox.markReceived(eventId,ctx),/OUTBOX_ABORT/);
 assert.deepEqual(stats(),{closed:1,writes:1});
});
