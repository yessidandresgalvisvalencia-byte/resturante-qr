"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { projectReconciliationDifferences } = require("../../core/finanzas/proyeccionDiferenciasP006");
const { reconcileMovements } = require("../../core/finanzas/reconciliacionExacta");
const { reconcileStock } = require("../../core/finanzas/conciliacionStockExacta");
function sample() {
  const empresaId = "e1", sedeId = "s1";
  return {
    empresaId, sedeId,
    financial: reconcileMovements({ empresaId, sedeId, expectedCentavos: "105",
      movements: [{ empresaId, sedeId, idempotencyKey: "sale1", centavos: "100" }] }),
    stock: reconcileStock({ empresaId, sedeId,
      records: [{ empresaId, sedeId, productoId: "p1", unidad: "g", registrado: "9", fisico: "7" }] })
  };
}
test("P0-06 projection displays exact differences without mutating sources", () => {
  const input = sample();
  const result = projectReconciliationDifferences(input);
  assert.deepEqual(result, { empresaId: "e1", sedeId: "s1", differenceCentavos: "5",
    cashMismatch: true, stockDifferences: [{ productoId: "p1", unidad: "g", diferencia: "-2" }], readOnly: true });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.stockDifferences[0]), true);
  assert.equal(input.stock.diferencias[0].registrado, "9");
});
test("P0-06 projection rejects cross-tenant results", () => {
  const input = sample();
  input.stock = { ...input.stock, empresaId: "e2" };
  assert.throws(() => projectReconciliationDifferences(input), /P006_PANEL_SCOPE_MISMATCH/);
});
test("P0-06 projection does not invoke malicious accessors or inherited indices", () => {
  const input = sample();
  let invoked = false;
  input.financial = { ...input.financial };\n  Object.defineProperty(input.financial, "differenceCentavos", { get() { invoked = true; return "0"; } });
  assert.throws(() => projectReconciliationDifferences(input), /P006_PANEL_CAMPO_INVALIDO/);
  assert.equal(invoked, false);
  const other = sample();
  const rows = new Array(1);
  other.stock = { ...other.stock, diferencias: rows };
  assert.throws(() => projectReconciliationDifferences(other), /P006_PANEL_INDICE_INVALIDO/);
});
