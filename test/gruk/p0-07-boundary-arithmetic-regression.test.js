"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { cents, safeCents, exactProduct, saleAmounts } = require("../../core/finanzas/dineroExacto");

test("P0-07: signed money boundaries are symmetric and never silently rounded", () => {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  assert.equal(cents("-0.01"), -1n);
  assert.equal(cents("0.0100"), 1n);
  assert.equal(safeCents(-max), -Number.MAX_SAFE_INTEGER / 100);
  assert.throws(() => cents("-90071992547409.92"), /DINERO_RANGO/);
  assert.throws(() => safeCents(-max - 1n), /DINERO_RANGO/);
  assert.throws(() => cents("0.001"), /DINERO_PRECISION/);
});

test("P0-07: fractional quantity must produce integral centavos", () => {
  assert.equal(exactProduct(200n, "0.005"), 1n);
  assert.throws(() => exactProduct(199n, "0.005"), /DINERO_PRODUCTO_PRECISION/);
  assert.throws(() => exactProduct(1n, "0.000001"), /DINERO_PRODUCTO_PRECISION/);
  assert.throws(() => exactProduct(1n, "0"), /DINERO_CANTIDAD_INVALIDA/);
});

test("P0-07: overflow and discount do not corrupt sale calculations", () => {
  assert.throws(() => exactProduct(BigInt(Number.MAX_SAFE_INTEGER), "2"), /DINERO_RANGO/);
  const sale = saleAmounts({
    precioUnitario: "100.00", precio: "75.00", costoUnitario: "25.00", cantidad: "2"
  });
  assert.equal(sale.total, 75);
  assert.equal(sale.costoTotal, 50);
  assert.equal(sale.utilidadBruta, 25);
});
