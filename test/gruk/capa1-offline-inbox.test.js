"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ensureInboxIndexes, acceptOfflineBatch } = require("../../core/offline/offlineInbox.service");
const ctx = { empresaId:"empresaA", sedeId:"sede1", actorId:"usuario1" };
const event = { eventId:"01K7R00YFBPZ7KYP62F4BXM2JN", empresaId:"empresaA", sedeId:"sede1", actorId:"usuario1", deviceId:"caja1", tipo:"VENTA_REGISTRADA", occurredAt:"2026-10-17T12:00:00.000Z", schemaVersion:1, payload:{ventaId:"venta1"} };
function fakeDb() {
  const rows = new Map(), indexes = [];
  const id = key => [key.empresaId,key.sedeId,key.eventId].join("/");
  const collection = {
    async createIndex(keys, options) { indexes.push({keys,options}); },
    async updateOne(key, operation, options) {
      assert.deepEqual(options, {upsert:true});
      assert.deepEqual(Object.keys(operation), ["$setOnInsert"]);
      if (rows.has(id(key))) return {upsertedCount:0};
      rows.set(id(key), operation.$setOnInsert);
      return {upsertedCount:1};
    },
    async findOne(key) { return rows.get(id(key)) || null; }
  };
  return { db:{collection(name){assert.equal(name,"gruk_offline_inbox");return collection;}}, rows, indexes };
}
test("offline inbox: unique tenant-scoped index", async () => {
  const f=fakeDb(); await ensureInboxIndexes(f.db);
  assert.deepEqual(f.indexes[0].keys,{empresaId:1,sedeId:1,eventId:1});
  assert.equal(f.indexes[0].options.unique,true);
});
test("offline inbox: identical retry accepted once", async () => {
  const f=fakeDb();
  assert.deepEqual(await acceptOfflineBatch({db:f.db,authenticatedContext:ctx,events:[event]}),[{eventId:event.eventId,status:"RECIBIDO"}]);
  assert.deepEqual(await acceptOfflineBatch({db:f.db,authenticatedContext:ctx,events:[{...event,payload:{ventaId:"venta1"}}]}),[{eventId:event.eventId,status:"YA_RECIBIDO"}]);
  assert.equal(f.rows.size,1);
  assert.equal([...f.rows.values()][0].status,"PENDIENTE");
});
test("offline inbox: reused eventId with different payload rejected",async()=>{
  const f=fakeDb(); await acceptOfflineBatch({db:f.db,authenticatedContext:ctx,events:[event]});
  await assert.rejects(acceptOfflineBatch({db:f.db,authenticatedContext:ctx,events:[{...event,payload:{ventaId:"venta2"}}]}),/OFFLINE_EVENT_CONFLICT/);
  assert.equal(f.rows.size,1);
});
test("offline inbox: another company cannot write through tenant context",async()=>{
  const f=fakeDb();
  await assert.rejects(acceptOfflineBatch({db:f.db,authenticatedContext:ctx,events:[{...event,empresaId:"empresaB"}]}),/OFFLINE_TENANT_MISMATCH/);
  assert.equal(f.rows.size,0);
});
test("offline inbox: duplicate-key race requires matching persisted hash",async()=>{
  const f=fakeDb(); await acceptOfflineBatch({db:f.db,authenticatedContext:ctx,events:[event]});
  const db={collection:()=>({updateOne:async()=>{const e=new Error("duplicate");e.code=11000;throw e;},findOne:async key=>[...f.rows.values()][0]})};
  assert.deepEqual(await acceptOfflineBatch({db,authenticatedContext:ctx,events:[event]}),[{eventId:event.eventId,status:"YA_RECIBIDO"}]);
  await assert.rejects(acceptOfflineBatch({db,authenticatedContext:ctx,events:[{...event,payload:{ventaId:"other"}}]}),/OFFLINE_EVENT_CONFLICT/);
});
