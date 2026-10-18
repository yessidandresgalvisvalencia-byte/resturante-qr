"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { appendOfflineLedgerEvent } = require("../../core/offline/offlineLedgerWriter.service");
const { ensureOfflineLedgerIndexes } = require("../../core/offline/offlineLedgerIndexes.service");

const uri = process.env.GRUK_TEST_MONGO_URI || process.env.TEST_MONGO_URI;
test("MongoDB real: ledger rechaza índice único con claves en orden incorrecto", {
  skip: !uri && "Requiere MongoDB replica set de pruebas",
  timeout: 45000
}, async () => {
  const { mongo } = require("mongoose");
  const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  const name = "gruk_idx_order_" + randomUUID().replace(/-/g, "");
  const context = { empresaId: "empresa-uno", sedeId: "sede-uno", actorId: "operador-uno" };
  const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FA0";
  const movement = { tipo: "VENTA_OFFLINE", montoCop: "15000" };
  let connected = false;
  try {
    await client.connect();
    connected = true;
    const db = client.db(name);
    const ledger = db.collection("gruk_ledger_movimientos");
    await ledger.createIndex(
      { eventId: 1, empresaId: 1, sedeId: 1, tipo: 1 },
      { name: "uniq_offline_ledger_event_type_tenant", unique: true }
    );
    const first = client.startSession();
    try {
      await assert.rejects(
        first.withTransaction(() => appendOfflineLedgerEvent({
          db, session: first, context, eventId, movement
        })),
        error => error?.code === "OFFLINE_LEDGER_UNIQUE_INDEX_REQUIRED"
      );
    } finally { await first.endSession(); }
    assert.equal(await ledger.countDocuments({}), 0);

    await ledger.dropIndex("uniq_offline_ledger_event_type_tenant");
    await ensureOfflineLedgerIndexes(db);
    const second = client.startSession();
    try {
      const entry = await second.withTransaction(() => appendOfflineLedgerEvent({
        db, session: second, context, eventId, movement
      }));
      assert.equal(entry.inserted, true);
    } finally { await second.endSession(); }
    assert.equal(await ledger.countDocuments({}), 1);
    const saved = await ledger.findOne({ empresaId: context.empresaId, sedeId: context.sedeId, eventId });
    assert.equal(saved.montoCop, "15000");
    assert.equal(saved.deletedAt, null);
  } finally {
    if (connected) {
      try { await client.db(name).dropDatabase(); } finally { await client.close(); }
    } else await client.close();
  }
});
