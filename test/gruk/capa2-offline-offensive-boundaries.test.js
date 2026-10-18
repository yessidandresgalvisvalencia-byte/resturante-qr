"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {acceptOfflineBatch, digest} = require("../../core/offline/offlineInbox.service");
const {validateBatch} = require("../../core/offline/offlineBatch.contract");
const ULID = "01ARZ3NDEKTSV4RRFFQ69G5FA0";
const auth = Object.freeze({empresaId:"tenant-A",sedeId:"site-1",actorId:"user-1"});
const other = Object.freeze({empresaId:"tenant-B",sedeId:"site-1",actorId:"user-2"});
function event(ctx=auth, change={}) {
  return {eventId:ULID,...ctx,deviceId:"tablet-1",tipo:"PEDIDO_REGISTRADO",
    occurredAt:"2026-10-18T12:00:00.000Z",schemaVersion:1,
    payload:{localOrderId:"order-1",totalCop:"1000"},...change};
}
function forbiddenDb() {
  return {collection() {throw new Error("DATABASE_TOUCHED_BEFORE_AUTHORIZATION");},
    client:{startSession(){throw new Error("TRANSACTION_TOUCHED_BEFORE_AUTHORIZATION");}}};
}
test("Capa 2: token B cannot submit A's events, including batches", async () => {
  await assert.rejects(acceptOfflineBatch({
    db:forbiddenDb(),authenticatedContext:other,events:[event(auth)]
  }),{code:"OFFLINE_TENANT_MISMATCH"});
  await assert.rejects(acceptOfflineBatch({
    db:forbiddenDb(),authenticatedContext:other,events:[
      event(other,{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA2"}),
      event(auth)
    ]
  }),{code:"OFFLINE_TENANT_MISMATCH"});
});
test("Capa 2: cross-site, actor spoofing and missing scope fail closed", async () => {
  for (const ctx of [
    {...auth,sedeId:"site-2"},
    {...auth,actorId:"user-2"},
    {empresaId:"tenant-A",actorId:"user-1"},
    {sedeId:"site-1",actorId:"user-1"},
    {empresaId:"tenant-A",sedeId:"site-1"},
    null
  ]) {
    await assert.rejects(acceptOfflineBatch({
      db:forbiddenDb(),authenticatedContext:ctx,events:[event(auth)]
    }),{code:ctx && ["empresaId","sedeId","actorId"].every(k=>ctx[k])?
      "OFFLINE_TENANT_MISMATCH":"OFFLINE_AUTH_REQUIRED"});
  }
});
test("Capa 2: Mongo operators and prototype pollution rejected before storage", async () => {
  const malicious = [
    {"$where":"this.empresaId !== 'tenant-A'"},
    {nested:{"$ne":null}},
    {"stock.cantidad":99},
    JSON.parse('{"__proto__":{"admin":true}}')
  ];
  for (const payload of malicious) {
    await assert.rejects(acceptOfflineBatch({
      db:forbiddenDb(),authenticatedContext:auth,events:[event(auth,{payload})]
    }),{code:"OFFLINE_UNSAFE_KEY"});
  }
});
test("Capa 2: payload tenant forgery never overrides verified event scope", async () => {
  const hostile = event(auth,{empresaId:other.empresaId});
  assert.throws(()=>validateBatch([hostile],auth),{code:"OFFLINE_TENANT_MISMATCH"});
  const unexpected = {...event(auth),tenantOverride:"tenant-B"};
  assert.throws(()=>validateBatch([unexpected],auth),{code:"OFFLINE_INVALID_EVENT"});
});
test("Capa 2: duplicate ULID and empty or excessive batches fail closed", async () => {
  await assert.rejects(acceptOfflineBatch({
    db:forbiddenDb(),authenticatedContext:auth,events:[event(auth),event(auth)]
  }),{code:"OFFLINE_DUPLICATE_EVENT"});
  await assert.rejects(acceptOfflineBatch({
    db:forbiddenDb(),authenticatedContext:auth,events:[]
  }),{code:"OFFLINE_BATCH_SIZE"});
  await assert.rejects(acceptOfflineBatch({
    db:forbiddenDb(),authenticatedContext:auth,events:Array.from({length:101},()=>event(auth))
  }),{code:"OFFLINE_BATCH_SIZE"});
});
test("Capa 2: canonical event digest is stable under payload key permutations", () => {
  const a=event(auth,{payload:{totalCop:"1000",localOrderId:"order-1"}});
  const b=event(auth,{payload:{localOrderId:"order-1",totalCop:"1000"}});
  assert.equal(digest(a),digest(b));
  assert.notEqual(digest(a),digest(event(auth,{payload:{totalCop:"1001",localOrderId:"order-1"}})));
});
