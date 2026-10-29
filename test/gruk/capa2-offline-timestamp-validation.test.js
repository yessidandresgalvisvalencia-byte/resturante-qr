"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateBatch } = require("../../core/offline/offlineBatch.contract");
const ctx = { empresaId: "empresaA", sedeId: "sedeA", actorId: "actorA" };
function event(occurredAt) {
  return { eventId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", empresaId: ctx.empresaId,
    sedeId: ctx.sedeId, actorId: ctx.actorId, deviceId: "tabletA",
    tipo: "PEDIDO_REGISTRADO", occurredAt, schemaVersion: 1, payload: {orderId:"orderA"} };
}
test("offline batch accepts valid leap day and timezone offset", () => {
  assert.equal(validateBatch([event("2024-02-29T23:59:59.123Z")],ctx).length,1);
  assert.equal(validateBatch([event("2026-10-29T18:30:00-05:00")],ctx).length,1);
});
test("offline batch refuses normalized impossible dates or times", () => {
  for (const timestamp of ["2026-02-30T10:00:00Z","2025-02-29T10:00:00Z",
    "2026-13-01T10:00:00Z","2026-04-31T10:00:00Z",
    "2026-10-29T24:00:00Z","2026-10-29T18:60:00Z",
    "2026-10-29T18:30:60Z","2026-10-29T18:30:00+24:00",
    "2026-10-29T18:30:00"]) {
    assert.throws(()=>validateBatch([event(timestamp)],ctx),/OFFLINE_INVALID_TIMESTAMP/,timestamp);
  }
});
