"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ensureOfflineLedgerIndexes } = require("../../core/offline/offlineLedgerIndexes.service");

test("offline ledger: exige base Mongo válida sin escrituras previas", async () => {
  await assert.rejects(() => ensureOfflineLedgerIndexes(null), { name: "TypeError", message: "OFFLINE_DATABASE_REQUIRED" });
  await assert.rejects(() => ensureOfflineLedgerIndexes({}), { name: "TypeError", message: "OFFLINE_DATABASE_REQUIRED" });
});

test("offline ledger: índice único incluye empresa, sede, evento y tipo", async () => {
  const calls = [];
  const db = {
    collection(name) {
      calls.push({ collection: name });
      return {
        async createIndex(keys, opts) {
          calls.push({ keys, opts });
          return opts.name;
        }
      };
    }
  };
  assert.equal(await ensureOfflineLedgerIndexes(db), true);
  assert.deepEqual(calls, [
    { collection: "gruk_ledger_movimientos" },
    {
      keys: { empresaId: 1, sedeId: 1, eventId: 1, tipo: 1 },
      opts: { unique: true, name: "uniq_offline_ledger_event_type_tenant" }
    }
  ]);
});

test("offline ledger: propaga fallo al crear índice; nunca habilita sin garantía única", async () => {
  const error = Object.assign(new Error("duplicate key"), { code: 11000 });
  const db = { collection: () => ({ createIndex: async () => { throw error; } }) };
  await assert.rejects(() => ensureOfflineLedgerIndexes(db), err => err === error);
});
