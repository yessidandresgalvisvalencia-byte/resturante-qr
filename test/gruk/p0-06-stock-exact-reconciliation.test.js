"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileStock } = require("../../core/finanzas/conciliacionStockExacta");
const row = (registered, physical, extra = {}) => ({
  empresaId: "e1", sedeId: "s1", productoId: "p1", unidad: "gramos",
  registrado: registered, fisico: physical, ...extra
});
const run = records => reconcileStock({ empresaId: "e1", sedeId: "s1", records });
test("reports immutable exact discrepancies without Number coercion", () => {
  const result = run([row("9007199254740991", "0")]);
  assert.equal(result.diferencias[0].diferencia, "-9007199254740991");
  assert.equal(result.balanced, false);
  assert.equal(Object.isFrozen(result.diferencias[0]), true);
  assert.equal(JSON.parse(JSON.stringify(result)).diferencias[0].registrado, "9007199254740991");
});
test("rejects cross-tenant records, duplicate stock keys and numeric quantities", () => {
  assert.throws(() => run([row("1", "2", { empresaId: "e2" })]), /STOCK_TENANT_INCORRECTO/);
  assert.throws(() => run([row("1", "2"), row("2", "3")]), /STOCK_REGISTRO_DUPLICADO/);
  assert.throws(() => run([row(1, "2")]), /STOCK_CANTIDAD_INVALIDA/);
  assert.throws(() => run([row("9007199254740992", "2")]), /STOCK_CANTIDAD_RANGO/);
});
test("rejects inherited fields and accessors without evaluating getters", () => {
  const record = row("1", "1");
  delete record.empresaId;
  Object.setPrototypeOf(record, { empresaId: "e1" });
  assert.throws(() => run([record]), /STOCK_CAMPO_INVALIDO_empresaId/);
  const record2 = row("1", "1");
  Object.defineProperty(record2, "fisico", { get() { throw Error("executed"); } });
  assert.throws(() => run([record2]), /STOCK_CAMPO_INVALIDO_fisico/);
});
test("balanced empty batch and bounded batch", () => {
  assert.deepEqual(run([]).diferencias, []);
  assert.equal(run([]).balanced, true);
  assert.throws(() => run(Array(10001).fill(row("0", "0"))), /STOCK_REGISTROS_INVALIDOS/);
});
