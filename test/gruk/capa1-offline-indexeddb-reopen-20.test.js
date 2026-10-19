"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function indexedDbHarness() {
  const persisted = new Map();
  let initialized = false;
  const onNextTick = callback => queueMicrotask(callback);
  let currentTransaction = null;
  const store = {
    add(record) {
      const request = {};
      onNextTick(() => {
        if (persisted.has(record.eventId)) {
          request.error = new Error("ConstraintError");
          currentTransaction.error = request.error;
          currentTransaction.onerror?.();
        } else {
          persisted.set(record.eventId, structuredClone(record));
          request.onsuccess?.();
        }
      });
      return request;
    },
    index(name) {
      assert.equal(name, "syncStatus");
      return {
        openCursor(status) {
          const request = {};
          const rows = [...persisted.values()].filter(x => x.syncStatus === status);
          let index = 0;
          function next() {
            onNextTick(() => {
              request.result = index < rows.length ? {
                value: structuredClone(rows[index++]),
                continue: next
              } : null;
              request.onsuccess?.();
            });
          }
          next();
          return request;
        }
      };
    }
  };
  const database = {
    objectStoreNames: { contains: name => initialized && name === "outbox" },
    createObjectStore(name, options) {
      assert.equal(name, "outbox");
      assert.equal(options.keyPath, "eventId");
      initialized = true;
      return { createIndex(index, field) { assert.equal(index, "syncStatus"); assert.equal(field, "syncStatus"); } };
    },
    transaction(name, mode) {
      assert.equal(name, "outbox");
      const t = {
        objectStore() { return store; },
        abort() { t.onabort?.(); }
      };
      // Transaction completion is dispatched after queued IDB store requests.
      currentTransaction = t;
      if (mode === "readwrite") setImmediate(() => { if (!t.error) t.oncomplete?.(); });
      return t;
    },
    close() {}
  };
  return {
    open(name, version) {
      assert.equal(name, "gruk-offline-v1");
      assert.equal(version, 1);
      const request = { result: database };
      onNextTick(() => {
        if (!initialized) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  };
}

function loadFreshOutbox(indexedDB) {
  const source = fs.readFileSync(path.join(__dirname, "../../public/js/gruk-offline-outbox.js"), "utf8");
  const module = { exports: {} };
  const context = { module, indexedDB, IDBKeyRange: { only: x => x }, Date, JSON, Promise, Error, setImmediate };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: "gruk-offline-outbox.js" });
  return module.exports;
}

test("IndexedDB offline: 20 eventos siguen pendientes tras reabrir la app sin internet", async () => {
  const indexedDB = indexedDbHarness();
  const contextA = { empresaId: "empresa-A", sedeId: "sede-1", actorId: "operador-1" };
  const contextB = { empresaId: "empresa-B", sedeId: "sede-1", actorId: "operador-1" };
  const ids = Array.from({ length: 20 }, (_, n) => String(n + 1).padStart(26, "0"));
  const appBeforeRestart = loadFreshOutbox(indexedDB);
  for (const eventId of ids) {
    assert.equal(await appBeforeRestart.putPending({ ...contextA, eventId, payload: { items: [{ productoId: "p", cantidad: 1 }] } }), eventId);
  }
  const appAfterRestart = loadFreshOutbox(indexedDB);
  const pending = await appAfterRestart.listPending(100, contextA);
  assert.equal(pending.length, 20);
  assert.deepEqual(Array.from(pending, x => x.eventId).sort(), ids.sort());
  assert.equal((await appAfterRestart.listPending(100, contextB)).length, 0);
  await assert.rejects(appAfterRestart.putPending({ ...contextA, eventId: ids[0] }));
  assert.equal((await appAfterRestart.listPending(100, contextA)).length, 20);
});

test("Capa 2: serialized event may not rewrite tenant or ULID before IndexedDB persistence",async()=>{
 const indexedDB=indexedDbHarness(),outbox=loadFreshOutbox(indexedDB);
 const tenant={empresaId:"empresa-A",sedeId:"sede-1",actorId:"operador-1"};
 const id="01ARZ3NDEKTSV4RRFFQ69G5FAV";
 const originals=[
  {eventId:id,...tenant,toJSON(){return {eventId:id,...tenant,empresaId:"empresa-B"};}},
  {eventId:id,...tenant,toJSON(){return {eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",...tenant};}},
  {eventId:id,...tenant,toJSON(){return null;}},
  {eventId:id,...tenant,toJSON(){throw Error("SERIALIZATION_FAILED");}}
 ];
 for(const event of originals){
  await assert.rejects(outbox.putPending(event),/OUTBOX_INVALID_EVENT_SNAPSHOT/);
 }
 assert.equal((await outbox.listPending(100,tenant)).length,0);
 assert.equal((await outbox.listPending(100,{...tenant,empresaId:"empresa-B"})).length,0);
 await outbox.putPending({eventId:id,...tenant});
 const reopened=loadFreshOutbox(indexedDB);
 assert.equal((await reopened.listPending(100,tenant)).length,1);
 assert.equal((await reopened.listPending(100,{...tenant,empresaId:"empresa-B"})).length,0);
});
