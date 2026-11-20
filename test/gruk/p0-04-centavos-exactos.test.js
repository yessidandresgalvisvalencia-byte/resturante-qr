"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { cents, safeCents, exactProduct, saleAmounts } = require("../../core/finanzas/dineroExacto");

test("P0-04 centavos: costs and margin use integer cents instead of binary floating calculations", () => {
  const r = saleAmounts({
    precioUnitario: "100.30", precio: "300.90",
    costoUnitario: "0.10", cantidad: 3
  });
  assert.equal(r.precioUnitario, 100.3);
  assert.equal(r.total, 300.9);
  assert.equal(r.costoTotal, 0.3);
  assert.equal(r.utilidadBruta, 300.6);
  assert.equal(cents(r.utilidadBruta), 30060n);
  assert.equal(cents(r.total) - cents(r.costoTotal), cents(r.utilidadBruta));
  assert.equal(exactProduct(cents("0.10"), "3"), 30n);
});

test("P0-04 centavos: discount remains permitted but cost never silently rounds fractional cents", () => {
  const discounted = saleAmounts({
    precioUnitario: "20.00", precio: "17.50",
    costoUnitario: "2.50", cantidad: "2"
  });
  assert.equal(discounted.total, 17.5);
  assert.equal(discounted.costoTotal, 5);
  assert.equal(discounted.utilidadBruta, 12.5);
  assert.throws(() => saleAmounts({
    precioUnitario: "1.00", precio: "1.00",
    costoUnitario: "0.01", cantidad: "0.5"
  }), /DINERO_PRODUCTO_PRECISION_costoTotal/);
});

test("P0-04 centavos: reject sub-cent values, nonfinite input and overflow rather than corrupt ledger", () => {
  for (const invalid of ["0.001", "1.234", "0.30000000000000004", "", "Infinity", "NaN", null, undefined]) {
    assert.throws(() => cents(invalid), /DINERO_/);
  }
  assert.throws(() => cents(Number.NaN), /DINERO_/);
  assert.throws(() => safeCents(9007199254740992n), /DINERO_RANGO/);
  assert.throws(() => saleAmounts({
    precioUnitario: "0.01", precio: "0.01", costoUnitario: "90071992547409.91",
    cantidad: 2
  }), /DINERO_RANGO/);
});

test("P0-04 centavos: money does not change cent count after repeated addition of 0.01", () => {
  let centavos = 0n;
  for (let i = 0; i < 10000; i++) centavos += cents("0.01");
  assert.equal(centavos, 10000n);
  assert.equal(safeCents(centavos), 100);
});
