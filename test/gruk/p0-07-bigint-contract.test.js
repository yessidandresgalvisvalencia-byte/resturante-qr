"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { safeCents, exactProduct, cents, saleAmounts } = require("../../core/finanzas/dineroExacto");

test("P0-07 safeCents accepts only BigInt centavos", () => {
  for (const invalid of [0, 12.5, "100", null, undefined, {}, true]) {
    assert.throws(() => safeCents(invalid, "total"), /DINERO_INVALIDO_total/);
  }
  assert.equal(safeCents(1230n), 12.3);
  assert.throws(() => safeCents(BigInt(Number.MAX_SAFE_INTEGER) + 1n), /DINERO_RANGO_monto/);
});

test("P0-07 exactProduct rejects implicit Number and string arithmetic", () => {
  for (const invalid of [100, "100", null, undefined, {}]) {
    assert.throws(() => exactProduct(invalid, "2"), /DINERO_INVALIDO_total/);
  }
  assert.equal(exactProduct(125n, "2"), 250n);
  assert.equal(cents("12.30"), 1230n);
});

test("P0-07 existing sale calculation remains exact at boundaries", () => {
  const sale = saleAmounts({
    precioUnitario: "12.30", precio: "18.45",
    costoUnitario: "5.00", cantidad: "1.5"
  });
  assert.equal(sale.costoTotal, 7.5);
  assert.equal(sale.utilidadBruta, 10.95);
});
