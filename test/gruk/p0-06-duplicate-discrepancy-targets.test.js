"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { projectReconciliationDifferences } = require("../../core/finanzas/proyeccionDiferenciasP006");

function result(diferencias) {
  return {
    empresaId: "tenantA", sedeId: "branchA",
    financial: { empresaId: "tenantA", sedeId: "branchA", differenceCentavos: "0" },
    stock: { empresaId: "tenantA", sedeId: "branchA", diferencias }
  };
}
test("P0-06 rejects duplicate stock correction targets without merging evidence", () => {
  assert.throws(() => projectReconciliationDifferences(result([
    { productoId: "p1", unidad: "g", diferencia: "-1" },
    { productoId: "p1", unidad: "g", diferencia: "2" }
  ])), /P006_PANEL_STOCK_DUPLICADO/);
});
test("P0-06 preserves distinct product/unit combinations and delimiter-like IDs", () => {
  const projection = projectReconciliationDifferences(result([
    { productoId: "a:b", unidad: "c", diferencia: "1" },
    { productoId: "a", unidad: "b:c", diferencia: "-0.25" },
    { productoId: "a:b", unidad: "kg", diferencia: "3" }
  ]));
  assert.equal(projection.stockDifferences.length, 3);
  assert.equal(Object.isFrozen(projection.stockDifferences), true);
});

test("P0-06 rejects whitespace-only stock product and unit identifiers", () => {
  for (const invalid of [
    { productoId: "   ", unidad: "kg", diferencia: "1" },
    { productoId: "p1", unidad: " \t ", diferencia: "-1" }
  ]) {
    assert.throws(() => projectReconciliationDifferences(result([invalid])), /P006_PANEL_STOCK_DATO_INVALIDO/);
  }
});
