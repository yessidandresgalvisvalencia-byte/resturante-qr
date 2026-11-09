"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { processStoredOfflinePedido } = require("../../core/offline/offlinePedidoStoredProcessor.service");

const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const valid = { empresaId: "507f1f77bcf86cd799439011", sedeId: "site-1", actorId: "actor-1" };

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


test("stored processor rejects noncanonical company IDs before inbox lookup", async () => {
  let calls = 0;
  const db = { collection() { calls++; throw Error("DB_MUST_NOT_BE_READ"); } };
  const client = { startSession() { calls++; throw Error("SESSION_MUST_NOT_START"); } };
  for (const empresaId of ["abcdefghijkl", "company-1", "507f1f77bcf86cd79943901", "507f1f77bcf86cd7994390110"]) {
    await assert.rejects(
      processStoredOfflinePedido({ db, client, context: { ...valid, empresaId }, eventId }),
      error => error?.code === "OFFLINE_COMPANY_ID_INVALID",
      empresaId
    );
  }
  assert.equal(calls, 0);
});

test("stored offline lookup never falls back across company, site, actor or event type", async () => {
  const stored = { ...valid, eventId, tipo: "PEDIDO_REGISTRADO" };
  const mismatches = [
    { empresaId: "507f1f77bcf86cd799439012" },
    { sedeId: "site-2" },
    { actorId: "actor-2" },
    { tipo: "PAGO_REGISTRADO" }
  ];
  for (const mismatch of mismatches) {
    const record = { ...stored, ...mismatch };
    let lookups = 0;
    let sessions = 0;
    const db = { collection(name) {
      assert.equal(name, "gruk_offline_inbox");
      return { async findOne(filter) {
        lookups++;
        assert.deepEqual(filter, stored);
        return Object.entries(filter).every(([key, value]) => record[key] === value) ? record : null;
      } };
    } };
    const client = { startSession() { sessions++; throw Error("SESSION_MUST_NOT_START"); } };
    await assert.rejects(
      processStoredOfflinePedido({ db, client, context: valid, eventId }),
      error => error?.code === "OFFLINE_EVENT_NOT_FOUND"
    );
    assert.equal(lookups, 1);
    assert.equal(sessions, 0);
  }
});
