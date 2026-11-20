"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { processPendingOfflinePedido } = require("../../core/offline/offlinePedidoAtomic.service");

const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const base = { empresaId: "507f1f77bcf86cd799439011", sedeId: "site-1", actorId: "actor-1" };

test("offline atomic processor rejects noncanonical tenant IDs before a transaction", async () => {
  let transactionCalls = 0;
  const db = { collection() { throw Error("DATABASE_MUST_NOT_BE_TOUCHED"); } };
  const session = { async withTransaction() { transactionCalls++; throw Error("TRANSACTION_MUST_NOT_START"); } };
  for (const empresaId of ["abcdefghijkl", "507f1f77bcf86cd79943901", "507f1f77bcf86cd7994390110", "not-an-object-id"]) {
    const context = { ...base, empresaId };
    const event = { eventId, tipo: "PEDIDO_REGISTRADO", ...context };
    await assert.rejects(
      processPendingOfflinePedido({ db, session, event, context }),
      error => error?.code === "OFFLINE_COMPANY_ID_INVALID",
      empresaId
    );
  }
  assert.equal(transactionCalls, 0);
});
