'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { exactFinancialSummary, persistedCents } = require('../../core/finance/enterpriseFinancialSummary');

test('aggregates legacy persisted records in integer cents', () => {
  assert.deepEqual(exactFinancialSummary([{total: 0.1}, {total: 0.2}], [{monto: 0.29}]).ingresos, '0.30');
  const result = exactFinancialSummary([{total: 0.1}, {total: 0.2}], [{monto: 0.31}]);
  assert.equal(result.resultado, '-0.01');
  assert.equal(result.origen, 'legacy-number');
});
test('empty scoped collections produce zero', () => {
  assert.equal(exactFinancialSummary([], []).resultado, '0.00');
});
test('rejects unsafe legacy values instead of rounding', () => {
  for (const value of [NaN, Infinity, -1, 0.001, 1e-8, '1.00', null, 1e21]) {
    assert.throws(() => persistedCents(value));
  }
  assert.throws(() => exactFinancialSummary([{total: 90071992547409.91}, {total: 1}], []));
  assert.throws(() => exactFinancialSummary([{total: 1}], [{monto: undefined}]));
});
test('does not mutate source records', () => {
  const venta = Object.freeze({total: 1.25});
  assert.equal(exactFinancialSummary([venta], []).ingresos, '1.25');
});
