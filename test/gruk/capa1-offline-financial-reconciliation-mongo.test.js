"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { ensureInboxIndexes, acceptOfflineBatch } = require("../../core/offline/offlineInbox.service");
const { readOfflineReconciliation } = require("../../core/offline/offlineReconciliation.service");
const uri = process.env.GRUK_TEST_MONGO_URI || process.env.TEST_MONGO_URI;

test("MongoDB real: 20 recibidos nunca son cobros; conciliación exige evidencia exacta", {
  skip: !uri && "Se necesita MongoDB de pruebas aislado",
  timeout: 45000
}, async () => {
  const { mongo } = require("mongoose");
  const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  const name = "gruk_fin_rec_" + randomUUID().replace(/-/g, "");
  const context = { empresaId: "empresa-uno", sedeId: "sede-uno", actorId: "operador-uno" };
  const eventIds = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(26, "0"));
  const events = eventIds.map(eventId => ({
    eventId, ...context, deviceId: "tablet-uno", tipo: "PEDIDO_REGISTRADO",
    occurredAt: "2026-10-18T12:00:00.000Z", schemaVersion: 1,
    payload: { items: [{ productoId: "sku-uno", cantidad: 1 }] }
  }));
  let connected = false;
  try {
    await client.connect();
    connected = true;
    const db = client.db(name);
    await ensureInboxIndexes(db);
    await acceptOfflineBatch({ db, authenticatedContext: context, events });
    const received = await readOfflineReconciliation({ db, context, eventIds });
    assert.equal(received.length, 20);
    assert.ok(received.every(e => e.status === "PENDIENTE" &&
      e.staged === false && e.financiallyReconciled === false && e.applied === false));

    const eventId = eventIds[0];
    const identity = { ...context, eventId };
    await db.collection("gruk_offline_ventas").insertOne({
      ...identity, totalCop: "10000", status: "CONTABILIZADA"
    });
    await db.collection("gruk_offline_caja_intenciones").insertOne({
      ...identity, montoCop: "10000", status: "CONCILIADO", cobrado: true
    });
    await db.collection("gruk_ledger_movimientos").insertOne({
      ...identity, montoCop: "9999", tipo: "VENTA_OFFLINE", deletedAt: null
    });
    const single = async () => (await readOfflineReconciliation({ db, context, eventIds: [eventId] }))[0];
    let state = await single();
    assert.equal(state.staged, false);
    assert.equal(state.applied, false);
    await db.collection("gruk_ledger_movimientos").updateOne(identity, { $set: { montoCop: "10000" } });
    state = await single();
    assert.equal(state.staged, true);
    assert.equal(state.financiallyReconciled, true);
    assert.equal(state.applied, false); // Inbox is still PENDIENTE, not APPLICADO.
    await db.collection("gruk_offline_inbox").updateOne(identity, { $set: { status: "APLICADO" } });
    state = await single();
    assert.equal(state.applied, false, "APLICADO sin inventario no es una venta aplicada");
    await db.collection("gruk_offline_inbox").updateOne(identity, { $set: { inventoryApplied: true } });
    state = await single();
    assert.equal(state.applied, true);

    // A duplicate journal or compromised cash amount must fail closed, not count as applied.
    await db.collection("gruk_ledger_movimientos").insertOne({
      ...identity, montoCop: "10000", tipo: "VENTA_OFFLINE", deletedAt: null
    });
    state = await single();
    assert.equal(state.staged, false);
    assert.equal(state.applied, false);

    // Another operator or company cannot enumerate the event through reconciliation.
    for (const foreign of [
      { ...context, empresaId: "empresa-otra" },
      { ...context, actorId: "operador-otro" }
    ]) {
      const item = (await readOfflineReconciliation({ db, context: foreign, eventIds: [eventId] }))[0];
      assert.deepEqual(item, {
        eventId, status: "NO_ENCONTRADO", applied: false,
        staged: false, financiallyReconciled: false
      });
    }
  } finally {
    if (connected) {
      try { await client.db(name).dropDatabase(); } finally { await client.close(); }
    } else await client.close();
  }
});
