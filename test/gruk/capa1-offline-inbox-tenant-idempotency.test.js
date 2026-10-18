"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {acceptOfflineBatch, ensureInboxIndexes} = require("../../core/offline/offlineInbox.service");

function memoryDb() {
  const rows = [];
  const indexes = [];
  const collection = {
    async createIndex(keys, options) { indexes.push({keys, options}); },
    async findOne(query) {
      return rows.find(row => Object.entries(query).every(([key, value]) => row[key] === value)) || null;
    },
    async updateOne(query, update, options) {
      assert.equal(options.upsert, true);
      assert.deepEqual(Object.keys(query).sort(), ["empresaId", "eventId", "sedeId"]);
      if (await this.findOne(query)) return {upsertedCount: 0};
      rows.push({...update.$setOnInsert});
      return {upsertedCount: 1};
    }
  };
  return {db: {collection(name) { assert.equal(name, "gruk_offline_inbox"); return collection; }}, rows, indexes};
}
const ID = "01ARZ3NDEKTSV4RRFFQ69G5FA0";
function context(empresaId, sedeId="sede-1") {
  return {empresaId, sedeId, actorId:"operador-1"};
}
function event(auth, overrides={}) {
  return {eventId: ID, ...auth, deviceId:"tablet-1", tipo:"PEDIDO_REGISTRADO",
    occurredAt:"2026-10-18T12:00:00.000Z", schemaVersion:1,
    payload:{localOrderId:"pedido-1", totalCop:"5000"}, ...overrides};
}

test("Capa 1: índice único incorpora empresa y sede", async () => {
  const {db,indexes} = memoryDb();
  await ensureInboxIndexes(db);
  assert.equal(indexes.length, 2);
  assert.deepEqual(indexes[0].keys, {empresaId:1,sedeId:1,eventId:1});
  assert.equal(indexes[0].options.unique, true);
});

test("Capa 1: reenvío del mismo evento es idempotente, no duplica venta recibida", async () => {
  const {db,rows} = memoryDb();
  const auth = context("empresa-A");
  assert.deepEqual(await acceptOfflineBatch({db,authenticatedContext:auth,events:[event(auth)]}),
    [{eventId:ID,status:"RECIBIDO"}]);
  assert.deepEqual(await acceptOfflineBatch({db,authenticatedContext:auth,events:[event(auth)]}),
    [{eventId:ID,status:"YA_RECIBIDO"}]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "PENDIENTE");
});

test("Capa 2: suplantación entre empresas o sedes se rechaza antes de DB", async () => {
  const {db,rows} = memoryDb();
  const auth = context("empresa-A");
  await assert.rejects(
    acceptOfflineBatch({db,authenticatedContext:context("empresa-B"),events:[event(auth)]}),
    {code:"OFFLINE_TENANT_MISMATCH"});
  await assert.rejects(
    acceptOfflineBatch({db,authenticatedContext:context("empresa-A","sede-2"),events:[event(auth)]}),
    {code:"OFFLINE_TENANT_MISMATCH"});
  assert.equal(rows.length,0);
});

test("Capa 1: mismo ULID y distinto importe se rechaza sin alterar original", async () => {
  const {db,rows} = memoryDb();
  const auth=context("empresa-A");
  await acceptOfflineBatch({db,authenticatedContext:auth,events:[event(auth)]});
  await assert.rejects(
    acceptOfflineBatch({db,authenticatedContext:auth,events:[
      event(auth,{payload:{localOrderId:"pedido-1",totalCop:"9000"}})]}),
    {code:"OFFLINE_EVENT_CONFLICT"});
  assert.equal(rows.length,1);
  assert.equal(rows[0].payload.totalCop,"5000");
});

test("Capa 2: mismo ULID en dos empresas tiene registros separados", async () => {
  const {db,rows} = memoryDb();
  const a=context("empresa-A"), b=context("empresa-B");
  assert.equal((await acceptOfflineBatch({db,authenticatedContext:a,events:[event(a)]}))[0].status,"RECIBIDO");
  assert.equal((await acceptOfflineBatch({db,authenticatedContext:b,events:[event(b)]}))[0].status,"RECIBIDO");
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(row=>row.empresaId),["empresa-A","empresa-B"]);
});
