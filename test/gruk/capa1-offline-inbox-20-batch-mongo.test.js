"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { acceptOfflineBatch, ensureInboxIndexes } = require("../../core/offline/offlineInbox.service");

const uri = process.env.GRUK_TEST_MONGO_URI || process.env.TEST_MONGO_URI;

test("MongoDB real: sync inbox 20 eventos, retry idempotente y conflicto atómico sin caja", {
  skip: !uri && "Requiere base de pruebas con replica set MongoDB",
  timeout: 45000
}, async () => {
  const { mongo } = require("mongoose");
  const client = new mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  const name = "gruk_sync_inbox_test_" + randomUUID().replace(/-/g, "");
  let connected = false;
  const context = { empresaId: "empresa-uno", sedeId: "sede-uno", actorId: "actor-uno" };
  const events = Array.from({ length: 20 }, (_, index) => ({
    eventId: String(index + 1).padStart(26, "0"),
    ...context,
    deviceId: "tablet-uno",
    tipo: "PEDIDO_REGISTRADO",
    occurredAt: "2026-10-18T12:00:00.000Z",
    schemaVersion: 1,
    payload: { items: [{ productoId: "sku-uno", cantidad: 1 }], referencia: String(index + 1) }
  }));
  try {
    await client.connect();
    connected = true;
    const db = client.db(name);
    await ensureInboxIndexes(db);
    const first = await acceptOfflineBatch({ db, authenticatedContext: context, events });
    assert.equal(first.length, 20);
    assert.ok(first.every(result => result.status === "RECIBIDO"));
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments(context), 20);

    const again = await acceptOfflineBatch({ db, authenticatedContext: context, events });
    assert.ok(again.every(result => result.status === "YA_RECIBIDO"));
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments(context), 20);

    // A changed duplicate in an otherwise fresh batch cannot partially commit.
    const modified = { ...events[0], payload: { ...events[0].payload, referencia: "adulterado" } };
    const fresh = { ...events[1], eventId: "99999999999999999999999999" };
    await assert.rejects(
      acceptOfflineBatch({ db, authenticatedContext: context, events: [fresh, modified] }),
      error => error?.code === "OFFLINE_EVENT_CONFLICT"
    );
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments(context), 20);
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({ ...context, eventId: fresh.eventId }), 0);

    // Receipt never posts money, stock movements or final sales.
    for (const table of ["gruk_ledger_movimientos", "gruk_offline_ventas", "gruk_offline_caja_intenciones"]) {
      assert.equal(await db.collection(table).countDocuments({}), 0, table + " must stay untouched");
    }

    const other = { empresaId: "empresa-dos", sedeId: "sede-uno", actorId: "actor-uno" };
    const otherEvent = { ...events[0], empresaId: other.empresaId };
    const separate = await acceptOfflineBatch({ db, authenticatedContext: other, events: [otherEvent] });
    assert.equal(separate[0].status, "RECIBIDO");
    assert.equal(await db.collection("gruk_offline_inbox").countDocuments({}), 21);
  } finally {
    if (connected) {
      try { await client.db(name).dropDatabase(); } finally { await client.close(); }
    } else await client.close();
  }
});
