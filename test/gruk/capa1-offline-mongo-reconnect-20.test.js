"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { ensureOfflineLedgerIndexes } = require("../../core/offline/offlineLedgerIndexes.service");

const uri = process.env.GRUK_TEST_MONGO_URI || process.env.TEST_MONGO_URI;

test("MongoDB real: 20 eventos offline sobreviven desconexión, reconexión y reintento", {
  skip: !uri && "Requiere MongoDB de prueba aislado",
  timeout: 45000
}, async () => {
  const { mongo } = require("mongoose");
  const database = "gruk_offline_restart_test_" + randomUUID().replace(/-/g, "");
  const first = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  const second = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  let firstConnected = false, secondConnected = false;
  const events = Array.from({ length: 20 }, (_, n) => ({
    empresaId: "empresa-a",
    sedeId: "sede-a",
    eventId: "offline-event-" + (n + 1),
    tipo: "VENTA_OFFLINE",
    montoCentavos: 1250
  }));
  try {
    await first.connect();
    firstConnected = true;
    const firstDb = first.db(database);
    await ensureOfflineLedgerIndexes(firstDb);
    await firstDb.collection("gruk_ledger_movimientos").insertMany(events, { ordered: true });
    assert.equal(await firstDb.collection("gruk_ledger_movimientos").countDocuments({}), 20);
    await first.close();
    firstConnected = false;

    // A fresh client models a restarted server connection without wiping storage.
    await second.connect();
    secondConnected = true;
    const ledger = second.db(database).collection("gruk_ledger_movimientos");
    assert.equal(await ledger.countDocuments({ empresaId: "empresa-a", sedeId: "sede-a" }), 20);
    const found = await ledger.find({ empresaId: "empresa-a", sedeId: "sede-a" })
      .project({ _id: 0, eventId: 1 }).toArray();
    assert.deepEqual(found.map(e => e.eventId).sort(), events.map(e => e.eventId).sort());

    const retries = await Promise.allSettled(events.map(({ _id, ...e }) => ledger.insertOne({ ...e })));
    assert.equal(retries.filter(r => r.status === "fulfilled").length, 0);
    assert.equal(retries.filter(r => r.status === "rejected" && r.reason?.code === 11000).length, 20);
    assert.equal(await ledger.countDocuments({}), 20);
    // The same event identifier in another company is not a duplicate.
    const { _id: ignoredId, ...otherCompanyEvent } = events[0];
    await ledger.insertOne({ ...otherCompanyEvent, empresaId: "empresa-b" });
    assert.equal(await ledger.countDocuments({}), 21);
  } finally {
    // Cleanup is restricted to this randomly named test database.
    if (secondConnected) {
      try { await second.db(database).dropDatabase(); } finally { await second.close(); }
    } else {
      await second.close();
      if (firstConnected) {
        try { await first.db(database).dropDatabase(); } finally { await first.close(); }
      } else {
        const cleanup = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
        try { await cleanup.connect(); await cleanup.db(database).dropDatabase(); } finally { await cleanup.close(); }
      }
    }
  }
});
