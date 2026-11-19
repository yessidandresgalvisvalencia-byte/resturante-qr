'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSale } = require('../../core/finance/enterpriseSalesMath');

test('exact cent arithmetic, discount and margin', () => {
  assert.deepEqual(calculateSale({quantity:'3',unitPrice:'0.10',unitCost:'0.07',total:'0.29'}), {
    grossCents:'30', discountCents:'1', revenueCents:'29', costCents:'21', profitCents:'8', marginBasisPoints:'2758'
  });
});
test('loss and zero revenue have explicit semantics', () => {
  assert.equal(calculateSale({quantity:'2',unitPrice:'1',unitCost:'2',total:'2'}).profitCents,'-200');
  assert.equal(calculateSale({quantity:'1',unitPrice:'0',unitCost:'1',total:'0'}).marginBasisPoints,null);
});
test('rejects ambiguous, subcent, negative, float and oversized inputs', () => {
  const valid={quantity:'1',unitPrice:'1.00',unitCost:'0.50',total:'1.00'};
  for(const patch of [{quantity:1},{quantity:'01'},{quantity:'0'},{unitPrice:1},{unitCost:'0.001'},{total:'-1'},{total:'1.01'},{quantity:'9999999999'},{quantity:'999999999',unitPrice:'90071992547409.91'}]) {
    assert.throws(()=>calculateSale({...valid,...patch}));
  }
});
test('output is immutable and inputs are unchanged', () => {
  const input=Object.freeze({quantity:'1',unitPrice:'1.11',unitCost:'0.10',total:'1.11'});
  const result=calculateSale(input);
  assert.ok(Object.isFrozen(result));
  assert.equal(result.profitCents,'101');
});
