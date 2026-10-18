"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { ensureOfflineLedgerIndexes } = require("../../core/offline/offlineLedgerIndexes.service");

const mongoUri = process.env.GRUK_TEST_MONGO_URI || process.env.TEST_MONGO_URI;

test("MongoDB real: ledger offline evita duplicados por empresa, sede, evento y tipo", {
  skip: !mongoUri && "Requiere MongoDB de prueba; nunca conectar a producción",
  timeout: 30000
}, async () => {
  const { mongo } = require("mongoose");
  const client = new mongo.MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });
  const database = "gruk_ledger_index_test_" + randomUUID().replace(/-/g, "");
  let connected = false;
  try {
    await client.connect();
    connected = true;
    const db = client.db(database);
    const ledger = db.collection("gruk_ledger_movimientos");
    await ensureOfflineLedgerIndexes(db);

    const identity = {
      empresaId: "empresa-A",
      sedeId: "sede-1",
      eventId: "evento-1",
      tipo: "VENTA_OFFLINE"
    };
    await ledger.insertOne({ ...identity, montoCentavos: 10000 });
    await assert.rejects(
      ledger.insertOne({ ...identity, montoCentavos: 10000 }),
      error => error && error.code === 11000
    );

    await ledger.insertMany([
      { ...identity, empresaId: "empresa-B", montoCentavos: 10000 },
      { ...identity, sedeId: "sede-2", montoCentavos: 10000 },
      { ...identity, eventId: "evento-2", montoCentavos: 10000 },
      { ...identity, tipo: "CORRECCION", montoCentavos: 10000 }
    ]);
    assert.equal(await ledger.countDocuments({}), 5);
    assert.equal(await ledger.countDocuments(identity), 1);

    // Concurrent retry storm from offline tablets must persist one journal entry.
    const concurrentIdentity = { ...identity, eventId: "evento-concurrente" };
    const attempts = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
      ledger.insertOne({ ...concurrentIdentity, montoCentavos: 10000, attempt: index })
    ));
    const accepted = attempts.filter(result => result.status === "fulfilled");
    const rejected = attempts.filter(result => result.status === "rejected");
    assert.equal(accepted.length, 1, "Solo un movimiento de veinte reintentos puede persistir");
    assert.equal(rejected.length, 19);
    for (const result of rejected) assert.equal(result.reason.code, 11000);
    assert.equal(await ledger.countDocuments(concurrentIdentity), 1);
    // The same event in a different tenant remains independent.
    await ledger.insertOne({ ...concurrentIdentity, empresaId: "empresa-B", montoCentavos: 10000 });
    assert.equal(await ledger.countDocuments({ eventId: "evento-concurrente" }), 2);

    const indexes = await ledger.indexes();
    assert.ok(indexes.some(index =>
      index.name === "uniq_offline_ledger_event_type_tenant" &&
      index.unique === true &&
      JSON.stringify(index.key) === JSON.stringify({
        empresaId: 1, sedeId: 1, eventId: 1, tipo: 1
      })
    ));
  } finally {
    if (connected) {
      try { await client.db(database).dropDatabase(); } finally { await client.close(); }
    } else {
      await client.close();
    }
  }
});
