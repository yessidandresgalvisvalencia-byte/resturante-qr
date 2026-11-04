"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { inventory, categories } = require("../../scripts/gruk-capability-inventory");
test("P0-02: eight scoped capabilities are inventoried without certification", () => {
  const rows = inventory();
  assert.deepEqual(rows.map(r => r.capability), [
    "pedidos", "caja", "inventario", "cocina", "facturacion", "empleados", "clientes", "finanzas"
  ]);
  assert.ok(rows.every(r => r.status === "SIN_VERIFICAR"));
  assert.ok(rows.every(r => r.evidence.length > 0));
});
test("P0-02: missing source evidence is visible, not silently accepted", () => {
  const rows = inventory(() => false);
  assert.ok(rows.every(r => r.evidence.every(e => e.present === false)));
});
test("P0-02: referenced repository paths exist", () => {
  const rows = inventory();
  assert.deepEqual(rows.flatMap(r => r.evidence.filter(e => !e.present).map(e => e.path)), []);
  assert.equal(Object.isFrozen(categories), true);
});
