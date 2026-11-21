"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reconcileMovements } = require("../../core/finanzas/reconciliacionExacta");

const item = (idempotencyKey, centavos) => ({
  empresaId: "empresa-a", sedeId: "sede-1", idempotencyKey, centavos
});
const reconcile = (movements, expectedCentavos = "0") =>
  reconcileMovements({ empresaId: "empresa-a", sedeId: "sede-1", movements, expectedCentavos });

test("P0-06 reconciliation is order-independent for unique movements", () => {
  const entries = [item("sale-1", "175"), item("refund-1", "-75"), item("sale-2", "25")];
  const forward = reconcile(entries, "125");
  const reverse = reconcile([...entries].reverse(), "125");
  assert.equal(forward.actualCentavos, "125");
  assert.equal(reverse.actualCentavos, forward.actualCentavos);
  assert.equal(reverse.differenceCentavos, forward.differenceCentavos);
  assert.equal(forward.balanced, true);
  assert.deepEqual(entries.map(x => x.idempotencyKey), ["sale-1", "refund-1", "sale-2"]);
});

test("P0-06 enforces the 10000-movement boundary without losing precision", () => {
  const entries = Array.from({ length: 10000 }, (_, i) => item("tx-" + i, "1"));
  const result = reconcile(entries, "10000");
  assert.equal(result.actualCentavos, "10000");
  assert.equal(result.uniqueMovements, 10000);
  assert.equal(result.balanced, true);
  assert.throws(() => reconcile([...entries, item("overflow", "1")]), /MOVIMIENTOS_INVALIDOS/);
});

test("P0-06 rejects a late cross-tenant entry rather than returning partial totals", () => {
  const entries = [item("valid", "200"), { ...item("foreign", "1"), empresaId: "empresa-b" }];
  assert.throws(() => reconcile(entries, "200"), /TENANT_INCORRECTO/);
});
