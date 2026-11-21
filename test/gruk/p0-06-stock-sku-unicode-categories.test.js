'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileStockSnapshot } = require('../../core/inventory/enterpriseStockReconciliation');

// Plan Maestro P0-06: canonical SKU must reject all Unicode control and format
// codepoints, not only a hand-picked subset. Pure helper; not tenant/E2E proof.
test('P0-06 rejects C1 controls and Unicode format characters in SKU', () => {
  const unsafe = ['\u0080', '\u009f', '\u061c', '\u034f', '\u200d', '\u206a', '\u180e'];
  for (const codepoint of unsafe) {
    const row = Object.freeze({ sku: 'A' + codepoint + 'B', recorded: '3', counted: '1' });
    assert.throws(() => reconcileStockSnapshot(Object.freeze([row])), TypeError,
      'unsafe codepoint U+' + codepoint.codePointAt(0).toString(16));
  }
});

test('P0-06 preserves safe Unicode SKU identity and exact differences', () => {
  const rows = Object.freeze([
    Object.freeze({ sku: 'CAFÉ-01', recorded: '5', counted: '3' }),
    Object.freeze({ sku: '商品-02', recorded: '0', counted: '2' })
  ]);
  const result = reconcileStockSnapshot(rows);
  assert.deepEqual(result.map(({ sku, differenceUnits }) => [sku, differenceUnits]),
    [['CAFÉ-01', '-2'], ['商品-02', '2']]);
  assert.ok(Object.isFrozen(result) && result.every(Object.isFrozen));
});
