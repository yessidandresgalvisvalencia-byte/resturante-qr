"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { appendMovement, ensureLedgerIndexes } = require("../../core/ledger/appendLedger.service");
const { verifyLedgerChain } = require("../../core/ledger/verifyLedger.service");

test("ledger: real MongoDB transaction, idempotent retry and tenant isolation", { timeout: 30000, skip: !process.env.GRUK_TEST_MONGO_URI }, async () => {
  const { MongoClient } = require("mongodb");
  const uri = process.env.GRUK_TEST_MONGO_URI;
  if (!uri) throw new Error("GRUK_TEST_MONGO_URI_REQUIRED");
  // This test owns an ephemeral database; refuse remote and multi-host URIs.
  const parsed = new URL(uri);
  if (parsed.protocol !== "mongodb:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
      parsed.username || parsed.password ||
      parsed.host.includes(",")) {
    throw new Error("GRUK_TEST_MONGO_LOCALHOST_ONLY");
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const testDbName = "gruk_capa1_ci_" + randomUUID().replace(/-/g, "");
  const db = client.db(testDbName);
  try {
    await ensureLedgerIndexes(db);
    const base = {
      client, db, empresaId: "companyA", sedeId: "s1", cuentaId: "cash",
      eventId: "evt001", tipo: "CREDITO", amountCentavos: "5200000",
      actorId: "user1", ip: "127.0.0.1"
    };
    const first = await appendMovement(base);
    assert.equal(first.afterCentavos, "5200000");
    const retry = await appendMovement({ ...base, ip: "10.1.1.1" });
    assert.equal(retry.alreadyApplied, true);
    assert.equal(await db.collection("gruk_ledger_movimientos").countDocuments({ empresaId: "companyA" }), 1);
    await assert.rejects(
      appendMovement({ ...base, amountCentavos: "1" }),
      /LEDGER_EVENT_CONFLICT/
    );
    const second = await appendMovement({
      ...base, empresaId: "companyB", eventId: "evt002", amountCentavos: "700"
    });
    assert.equal(second.beforeCentavos, "0");
    const docs = await db.collection("gruk_ledger_movimientos")
      .find({ empresaId: "companyA", sedeId: "s1", cuentaId: "cash" })
      .sort({ secuencia: 1 }).toArray();
    const head = await db.collection("gruk_ledger_heads")
      .findOne({ empresaId: "companyA", sedeId: "s1", cuentaId: "cash" });
    assert.equal(verifyLedgerChain({ movements: docs, head }).valid, true);
  } finally {
    await db.dropDatabase();
    await client.close();
  }
});
