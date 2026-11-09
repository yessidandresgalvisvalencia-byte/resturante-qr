"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { processStoredOfflinePedido } = require("../../core/offline/offlinePedidoStoredProcessor.service");

const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const valid = { empresaId: "company-1", sedeId: "site-1", actorId: "actor-1" };

test("stored offline processor rejects missing, blank and noncanonical auth scope before database access", async () => {
  let calls = 0;
  const db = { collection() { calls++; throw Error("DB_MUST_NOT_BE_READ"); } };
  const client = { startSession() { calls++; throw Error("SESSION_MUST_NOT_START"); } };
  for (const field of Object.keys(valid)) {
    for (const value of ["", " ", "  x", "x  ", null, 123]) {
      const context = { ...valid, [field]: value };
      await assert.rejects(
        processStoredOfflinePedido({ db, client, context, eventId }),
        error => error?.code === "OFFLINE_AUTH_REQUIRED",
        `field=${field} value=${JSON.stringify(value)}`
      );
    }
  }
  await assert.rejects(
    processStoredOfflinePedido({ db, client, context: null, eventId }),
    error => error?.code === "OFFLINE_AUTH_REQUIRED"
  );
  assert.equal(calls, 0);
});

test("valid stored offline scope proceeds to tenant-scoped inbox lookup", async () => {
  let filter;
  const db = { collection(name) {
    assert.equal(name, "gruk_offline_inbox");
    return { async findOne(q) { filter = q; return null; } };
  } };
  const client = { startSession() { throw Error("SESSION_MUST_NOT_START"); } };
  await assert.rejects(
    processStoredOfflinePedido({ db, client, context: valid, eventId }),
    error => error?.code === "OFFLINE_EVENT_NOT_FOUND"
  );
  assert.deepEqual(filter, { ...valid, eventId, tipo: "PEDIDO_REGISTRADO" });
});
