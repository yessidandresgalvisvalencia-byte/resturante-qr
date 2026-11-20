"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularVariacion } = require("../../intelligence/evidence/evidencia.service");

test("P0-15: KPI ausente no se convierte en cero observado", () => {
  for (const missing of [null, undefined, "", "  ", false, true, NaN, Infinity, {}, []]) {
    assert.deepEqual(calcularVariacion(missing, 100), { absoluta: null, porcentual: null });
    assert.deepEqual(calcularVariacion(100, missing), { absoluta: null, porcentual: null });
  }
});
test("P0-15: cero medido es distinto de KPI ausente", () => {
  assert.deepEqual(calcularVariacion(0, 10), { absoluta: 10, porcentual: null });
  assert.deepEqual(calcularVariacion("0", "10"), { absoluta: 10, porcentual: null });
});
test("P0-15: mediciones reales mantienen variación y signo", () => {
  assert.deepEqual(calcularVariacion("100", "90"), { absoluta: -10, porcentual: -10 });
  assert.deepEqual(calcularVariacion(-100, -90), { absoluta: 10, porcentual: 10 });
});
test("P0-15: valores no numéricos no generan impacto ficticio", () => {
  for (const value of ["sin dato", "NaN", "Infinity"]) {
    assert.deepEqual(calcularVariacion(value, 100), { absoluta: null, porcentual: null });
  }
});
