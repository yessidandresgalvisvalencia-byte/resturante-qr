"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { processPendingOfflinePedido } = require("../../core/offline/offlinePedidoAtomic.service");

const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const context = { empresaId: "507f1f77bcf86cd799439011", sedeId: "sede-1", actorId: "actor-1" };
const event = { ...context, eventId, tipo: "PEDIDO_REGISTRADO" };

test("atomic offline processor rejects malformed auth scope before starting transaction or reading MongoDB", async () => {
  let dbCalls = 0;
  let transactionCalls = 0;
  const db = { collection() { dbCalls++; throw Error("UNEXPECTED_DB_READ"); } };
  const session = { withTransaction() { transactionCalls++; throw Error("UNEXPECTED_TRANSACTION"); } };
  for (const field of ["empresaId", "sedeId", "actorId"]) {
    for (const value of ["", " ", "  id", "id  ", null, 123]) {
      await assert.rejects(
        processPendingOfflinePedido({ db, session, context: { ...context, [field]: value }, event }),
        error => error?.code === "OFFLINE_AUTH_REQUIRED",
        `field=${field} value=${JSON.stringify(value)}`
      );
    }
  }
  assert.equal(dbCalls, 0);
  assert.equal(transactionCalls, 0);
});

test("canonical scope passes authentication and reaches transactional inbox lookup", async () => {
  let transactionCalls = 0;
  const db = { collection(name) {
    assert.equal(name, "gruk_offline_inbox");
    return { findOne: async () => null };
  } };
  const session = { withTransaction: async fn => { transactionCalls++; await fn(); } };
  await assert.rejects(
    processPendingOfflinePedido({ db, session, context, event }),
    error => error?.code === "OFFLINE_EVENT_NOT_FOUND"
  );
  assert.equal(transactionCalls, 1);
});
