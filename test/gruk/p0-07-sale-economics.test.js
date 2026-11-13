'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { saleEconomics } = require('../../core/finance/enterpriseSaleEconomics');

test('cost multiplication and signed profit preserve exact cents', () => {
  assert.deepEqual(saleEconomics({quantity:'3',total:'0.31',unitCost:'0.10'}), {
    costTotal:'0.30',profit:'0.01',marginBasisPoints:'323'
  });
  assert.deepEqual(saleEconomics({quantity:'3',total:'0.29',unitCost:'0.10'}), {
    costTotal:'0.30',profit:'-0.01',marginBasisPoints:'-345'
  });
});
test('zero revenue and input validation do not produce NaN or infinity', () => {
  assert.equal(saleEconomics({quantity:'1',total:'0.00',unitCost:'0.01'}).marginBasisPoints,'0');
  for (const quantity of ['0','1.5','01',1,'-1']) {
    assert.throws(() => saleEconomics({quantity,total:'1.00',unitCost:'0.01'}));
  }
  assert.throws(() => saleEconomics({quantity:'2',total:'1.00',unitCost:'90071992547409.91'}), RangeError);
});
