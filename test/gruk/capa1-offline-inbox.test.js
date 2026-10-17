"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ensureInboxIndexes, acceptOfflineBatch } = require("../../core/offline/offlineInbox.service");
const ctx = { empresaId:"empresaA", sedeId:"sede1", actorId:"usuario1" };
const event = { eventId:"01K7R00YFBPZ7KYP62F4BXM2JN", empresaId:"empresaA", sedeId:"sede1", actorId:"usuario1",deviceId:"caja1",tipo:"VENTA_REGISTRADA",occurredAt:"2026-10-17T12:00:00.000Z",schemaVersion:1,payload:{ventaId:"venta1"} };
function fakeDb() {
  const rows = new Map();
  const indexes = [];
  const collection = {
    async createIndex(keys, options) { indexes.push({keys,options}); },
    async updateOne(key, operation, options) {
      assert.deepEqual(options, {upsert:true});
      assert.deepEqual(Object.keys(operation), ["$setOnInsert"]);
      const id = [key.empresaId,key.sedeId,key.eventId].join("/");
      if (rows.has(id)) return {upsertedCount:0};
      rows.set(id, operation.$setOnInsert);
      return {upsertedCount:1};
    }
  };
  return { db:{collection(name){assert.equal(name,"gruk_offline_inbox");return collection;}},rows,indexes };
}
test("offline inbox: creates tenant-scoped unique event index", async () => {
  const f=fakeDb();
  await ensureInboxIndexes(f.db);
  assert.deepEqual(f.indexes[0].keys,{empresaId:1,sedeId:1,eventId:1});
  assert.equal(f.indexes[0].options.unique,true);
});
test("offline inbox: repeated sale event is recorded only once", async () => {
  const f=fakeDb();
  assert.deepEqual(await acceptOfflineBatch({db:f.db,authenticatedContext:ctx,events:[event]}),[{eventId:event.eventId,status:"RECIBIDO"}]);
  assert.deepEqual(await acceptOfflineBatch({db:f.db,authenticatedContext:ctx,events:[event]}),[{eventId:event.eventId,status:"YA_RECIBIDO"}]);
  assert.equal(f.rows.size,1);
  assert.equal([...f.rows.values()][0].status,"PENDIENTE");
});
test("offline inbox: another tenant cannot write through the same context", async () => {
  const f=fakeDb();
  await assert.rejects(acceptOfflineBatch({db:f.db,authenticatedContext:ctx,events:[{...event,empresaId:"empresaB"}]}),/OFFLINE_TENANT_MISMATCH/);
  assert.equal(f.rows.size,0);
});
test("offline inbox: duplicate key race does not insert twice",async () => {
  const db={collection:()=>({updateOne:async()=>{const error=new Error("duplicate");error.code=11000;throw error;}})};
  assert.deepEqual(await acceptOfflineBatch({db,authenticatedContext:ctx,events:[event]}),[{eventId:event.eventId,status:"YA_RECIBIDO"}]);
});
