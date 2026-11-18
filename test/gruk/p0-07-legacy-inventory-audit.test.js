"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { auditLegacyInventoryRow } = require("../../core/finance/auditLegacyInventoryRow");

test("accepts ordinary legacy inventory without modifying it", () => {
  const row = Object.freeze({ cantidad: 2.5, costo: 12.34 });
  assert.deepEqual(auditLegacyInventoryRow(row), { safe: true, issues: [] });
  assert.equal(row.costo, 12.34);
});
test("rejects unsafe monetary values and sub-cent prices", () => {
  assert.ok(auditLegacyInventoryRow({ cantidad: 1, costo: Number.MAX_SAFE_INTEGER }).issues.length);
  assert.ok(auditLegacyInventoryRow({ cantidad: 1, costo: 1.234 }).issues.includes("COSTO_SUBCENT"));
  assert.ok(auditLegacyInventoryRow({ cantidad: 1, costo: 0.00000000001 }).issues.includes("COSTO_SUBCENT"));
  assert.ok(auditLegacyInventoryRow({ cantidad: 1, costo: 1.00000000001 }).issues.includes("COSTO_SUBCENT"));
  assert.equal(auditLegacyInventoryRow({ cantidad: 1, costo: 1.11 }).safe, true);
});
test("does not execute hostile accessors", () => {
  const row = { cantidad: 1 };
  Object.defineProperty(row, "costo", { get() { throw Error("executed"); } });
  assert.ok(auditLegacyInventoryRow(row).issues.includes("COSTO_MISSING_OR_ACCESSOR"));
});
test("rejects invalid rows and nonfinite quantity", () => {
  assert.equal(auditLegacyInventoryRow(null).safe, false);
  assert.equal(auditLegacyInventoryRow({ cantidad: Infinity, costo: 1 }).safe, false);
});

test("rejects negative zero without normalizing historical data", () => {
  const quantity = Object.freeze({ cantidad: -0, costo: 1 });
  const cost = Object.freeze({ cantidad: 1, costo: -0 });
  assert.ok(auditLegacyInventoryRow(quantity).issues.includes("CANTIDAD_INVALID"));
  assert.ok(auditLegacyInventoryRow(cost).issues.includes("COSTO_INVALID"));
  assert.ok(Object.is(quantity.cantidad, -0));
  assert.ok(Object.is(cost.costo, -0));
  assert.equal(auditLegacyInventoryRow({ cantidad: 0, costo: 0 }).safe, true);
});
