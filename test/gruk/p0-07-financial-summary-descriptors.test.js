'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { exactFinancialSummary } = require('../../core/finance/enterpriseFinancialSummary');

test('rejects inherited monetary fields rather than including untrusted values', () => {
  const inherited = Object.create({ total: 100 });
  assert.throws(() => exactFinancialSummary([inherited], []), TypeError);
  assert.throws(() => exactFinancialSummary([], [Object.create({ monto: 10 })]), TypeError);
});

test('rejects executable accessors without invoking them', () => {
  let executed = 0;
  const venta = {};
  Object.defineProperty(venta, 'total', { enumerable: true, get() { executed++; return 1; } });
  assert.throws(() => exactFinancialSummary([venta], []), TypeError);
  const rows = [];
  Object.defineProperty(rows, '0', { configurable: true, get() { executed++; return { total: 1 }; } });
  rows.length = 1;
  assert.throws(() => exactFinancialSummary(rows, []), TypeError);
  assert.equal(executed, 0);
});

test('rejects sparse arrays instead of silently undercounting revenue', () => {
  const rows = new Array(2);
  rows[1] = { total: 12.5 };
  assert.throws(() => exactFinancialSummary(rows, []), TypeError);
});

test('preserves exact values for own data fields and frozen input', () => {
  const venta = Object.freeze(Object.defineProperty({}, 'total', { value: 0.1, enumerable: true }));
  const gasto = Object.freeze({ monto: 0.29 });
  const result = exactFinancialSummary(Object.freeze([venta, { total: 0.2 }]), Object.freeze([gasto]));
  assert.equal(result.ingresos, '0.30');
  assert.equal(result.gastos, '0.29');
  assert.equal(result.resultado, '0.01');
});

test('rejects negative zero in persisted revenue and expense rather than normalizing its sign', () => {
  assert.throws(() => exactFinancialSummary([{ total: -0 }], []), TypeError);
  assert.throws(() => exactFinancialSummary([], [{ monto: -0 }]), TypeError);
  assert.equal(exactFinancialSummary([{ total: 0 }], [{ monto: 0 }]).resultado, '0.00');
});
