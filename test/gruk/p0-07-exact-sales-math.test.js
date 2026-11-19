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

test('legacy Number bridge calculates cents without float multiplication', () => {
  const { calculateLegacySale } = require('../../core/finance/enterpriseSalesMath');
  const result = calculateLegacySale({quantity:3,unitPrice:0.1,unitCost:0.07,total:0.29});
  assert.equal(result.costCents,'21');
  assert.equal(result.profitCents,'8');
});
test('legacy bridge fails closed on ambiguous historic precision', () => {
  const { calculateLegacySale, canonicalLegacyMoney } = require('../../core/finance/enterpriseSalesMath');
  const base={quantity:1,unitPrice:1,unitCost:0.1,total:1};
  for (const patch of [
    {quantity:1.5},{quantity:0},{quantity:Number.MAX_SAFE_INTEGER+1},
    {unitCost:0.001},{unitPrice:-0},{total:NaN},
    {total:Infinity},{total:1e-7},{total:-1}
  ]) assert.throws(()=>calculateLegacySale({...base,...patch}));
  assert.throws(()=>canonicalLegacyMoney('0.10'));
  assert.equal(canonicalLegacyMoney(0),'0');
});

test('legacy decimal bridge accepts ordinary cent-exact multi-digit values', () => {
  const { canonicalLegacyMoney, calculateLegacySale } = require('../../core/finance/enterpriseSalesMath');
  for (const value of [0.1, 1.25, 12, 12.34, 1234.56]) {
    assert.equal(canonicalLegacyMoney(value), String(value));
  }
  const result = calculateLegacySale({quantity:2,unitPrice:12.34,unitCost:1.25,total:24.68});
  assert.equal(result.grossCents,'2468');
  assert.equal(result.costCents,'250');
  assert.equal(result.profitCents,'2218');
});

test('sale input rejects inherited and accessor fields without invoking getters', () => {
  const { calculateLegacySale } = require('../../core/finance/enterpriseSalesMath');
  let invoked = 0;
  const base = { quantity:'1', unitPrice:'1.00', unitCost:'0.10', total:'1.00' };
  const accessor = { ...base };
  Object.defineProperty(accessor, 'unitCost', { enumerable:true, get() { invoked++; throw Error('unsafe getter'); } });
  assert.throws(() => calculateSale(accessor), /own data property/);
  assert.equal(invoked, 0);
  const inherited = Object.create({ quantity:'1' });
  Object.assign(inherited, { unitPrice:'1', unitCost:'0', total:'1' });
  assert.throws(() => calculateSale(inherited), /own data property/);
  const legacy = { quantity:1, unitPrice:1, unitCost:0.1, total:1 };
  Object.defineProperty(legacy, 'total', { get() { invoked++; return 1; } });
  assert.throws(() => calculateLegacySale(legacy), /own data property/);
  assert.equal(invoked, 0);
  assert.equal(calculateSale(Object.assign(Object.create(null), base)).profitCents, '90');
});
