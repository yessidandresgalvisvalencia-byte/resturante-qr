"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileStock } = require("../../core/finanzas/conciliacionStockExacta");
const record = (productoId, registrado, fisico, unidad = "gramos") => ({
  empresaId: "e1", sedeId: "s1", productoId, unidad, registrado, fisico
});
const reconcile = records => reconcileStock({ empresaId: "e1", sedeId: "s1", records });

test("stock reconciliation is deterministic across input order and units", () => {
  const rows = [record("p2", "5", "3"), record("p1", "1", "2", "unidades"),
    record("p1", "3", "3", "gramos")];
  const a = reconcile(rows);
  const b = reconcile([...rows].reverse());
  assert.deepEqual(a, b);
  assert.equal(a.totalRegistros, 3);
  assert.deepEqual(a.diferencias.map(d => [d.productoId, d.unidad, d.diferencia]),
    [["p1", "unidades", "1"], ["p2", "gramos", "-2"]]);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(Object.isFrozen(a.diferencias), true);
});

test("accepts 10000 distinct stock rows and rejects a 10001st", () => {
  const rows = Array.from({ length: 10000 }, (_, i) => record("p" + i, "0", "0"));
  const result = reconcile(rows);
  assert.equal(result.totalRegistros, 10000);
  assert.equal(result.balanced, true);
  assert.equal(result.diferencias.length, 0);
  assert.throws(() => reconcile([...rows, record("extra", "0", "0")]), /STOCK_REGISTROS_INVALIDOS/);
});

test("rejects malformed scope, invalid quantities and duplicate keys before returning evidence", () => {
  assert.throws(() => reconcile([record("p1", "0", "1"), record("p2", "1", "1", "gramos"), {
    ...record("p3", "1", "2"), sedeId: "other"
  }]), /STOCK_TENANT_INCORRECTO/);
  for (const bad of ["-1", "01", "1.0", "1e3", "9007199254740992", ""]) {
    assert.throws(() => reconcile([record("p1", bad, "0")]), /STOCK_CANTIDAD_/);
  }
  assert.throws(() => reconcile([record("p1", "0", "0"), record("p1", "1", "2")]),
    /STOCK_REGISTRO_DUPLICADO/);
});
