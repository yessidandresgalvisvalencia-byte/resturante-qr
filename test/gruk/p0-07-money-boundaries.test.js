'use strict';

// Plan Maestro 07 [P0]: deterministic COP money boundary regression.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMoneyToCents, formatCents } = require('../../core/finance/enterpriseMoney');

 test('P0-07 accepts exact maximum safe cents and round-trips without Number', () => {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const canonical = '90071992547409.91';
  assert.equal(parseMoneyToCents(canonical), max);
  assert.equal(formatCents(max), canonical);
  assert.equal(parseMoneyToCents('0.01'), 1n);
  assert.equal(formatCents(0n), '0.00');
});

test('P0-07 rejects cents beyond safe boundary rather than rounding', () => {
  assert.throws(() => parseMoneyToCents('90071992547409.92'), RangeError);
  assert.throws(() => formatCents(BigInt(Number.MAX_SAFE_INTEGER) + 1n), RangeError);
});

test('P0-07 rejects ambiguous, negative and noncanonical financial input', () => {
  for (const input of ['-0', '-0.00', '+1', '01', '1.', '.5', '1.234', '1e2', '1,00', ' 1', '1 ', 'NaN', 'Infinity', '0'.repeat(10000)]) {
    assert.throws(() => parseMoneyToCents(input), { name: /^(TypeError|RangeError)$/ });
  }
  for (const input of [0, 1.1, NaN, Infinity, null, undefined, {}, 1n]) {
    assert.throws(() => parseMoneyToCents(input), TypeError);
  }
});
