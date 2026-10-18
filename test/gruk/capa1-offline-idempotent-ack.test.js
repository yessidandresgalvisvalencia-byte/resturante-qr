"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { markReceived } = require("../../public/js/gruk-offline-outbox");
const ctx = { empresaId:"empresaA",sedeId:"sedeA",actorId:"actorA" };
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
function mockIndexedDB(records){
  return {open(){
    const request={};
    queueMicrotask(()=>{
      request.result={
        close(){},
        transaction(){
          const transaction={
            objectStore(){return {
              get(eventId){
                const getRequest={};
                queueMicrotask(()=>{
                  getRequest.result=records.get(eventId);
                  getRequest.onsuccess?.();
                  queueMicrotask(()=>transaction.oncomplete?.());
                });
                return getRequest;
              },
              put(record){records.set(record.eventId,structuredClone(record));}
            };}
          };
          return transaction;
        }
      };
      request.onsuccess?.();
    });
    return request;
  }};
}
test("offline ACK: repeated receipt is idempotent, tenant scoped and preserves date",async()=>{
  const old=global.indexedDB;
  const records=new Map([[id,{eventId:id,event:{eventId:id,...ctx},syncStatus:"pending"}]]);
  global.indexedDB=mockIndexedDB(records);
  try{
    assert.equal(await markReceived(id,ctx),true);
    const first=structuredClone(records.get(id));
    assert.equal(first.syncStatus,"received");
    assert.ok(first.receivedAt);
    assert.equal(await markReceived(id,ctx),true);
    assert.deepEqual(records.get(id),first,"repeat must not rewrite timestamp");
    assert.equal(await markReceived(id,{...ctx,empresaId:"empresaB"}),false);
    assert.deepEqual(records.get(id),first,"cross-tenant cannot change records");
    assert.equal(await markReceived("01ARZ3NDEKTSV4RRFFQ69G5FAW",ctx),false);
    records.get(id).syncStatus="conflict";
    assert.equal(await markReceived(id,ctx),false,"conflict must not masquerade as received");
  }finally{
    if(old===undefined)delete global.indexedDB;
    else global.indexedDB=old;
  }
});
