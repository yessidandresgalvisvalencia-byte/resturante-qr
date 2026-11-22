"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileFromMongoCollections } = require("../../core/finanzas/conciliacionMongoIntegradaP006");

function collection(rows) {
  return {
    find(filter) {
      assert.deepEqual(filter, { empresaId: "empresa1", sedeId: "sede1" });
      return { limit(n) { return { async toArray() { return rows; } }; } };
    }
  };
}
const scope = { empresaId: "empresa1", sedeId: "sede1" };
function request(movements, stock = []) {
  return { ...scope, movementsCollection: collection(movements),
    stockCollection: collection(stock), expectedCentavos: "0" };
}

test("P0-06 rejects oversized movement snapshots even if the driver ignores limit", async () => {
  const row = { ...scope, idempotencyKey: "sale", centavos: "0" };
  await assert.rejects(
    reconcileFromMongoCollections(request(Array.from({ length: 10001 }, () => row))),
    /P006_MONGO_LIMITE/
  );
});

test("P0-06 rejects oversized stock snapshots even if the driver ignores limit", async () => {
  const row = { ...scope, productoId: "item", unidad: "g", registrado: "0", fisico: "0" };
  await assert.rejects(
    reconcileFromMongoCollections(request([], Array.from({ length: 10001 }, () => row))),
    /P006_MONGO_LIMITE/
  );
});

test("P0-06 rejects accessor movement rows without executing getters", async () => {
  let executed = false;
  const rows = [];
  Object.defineProperty(rows, "0", { configurable: true, enumerable: true,
    get() { executed = true; throw Error("getter executed"); } });
  rows.length = 1;
  await assert.rejects(reconcileFromMongoCollections(request(rows)),
    /P006_MONGO_REGISTRO_INVALIDO/);
  assert.equal(executed, false);
});

test("P0-06 rejects sparse stock snapshots without inherited index fallback", async () => {
  const rows = new Array(1);
  await assert.rejects(reconcileFromMongoCollections(request([], rows)),
    /P006_MONGO_REGISTRO_INVALIDO/);
});
