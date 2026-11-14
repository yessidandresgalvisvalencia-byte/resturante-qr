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

test('safe-cent multiplication boundary and overflow are explicit', () => {
  assert.deepEqual(saleEconomics({quantity:'9007199254740991',total:'0.00',unitCost:'0.01'}), {
    costTotal:'90071992547409.91',
    profit:'-90071992547409.91',
    marginBasisPoints:'0'
  });
  assert.throws(() => saleEconomics({quantity:'9007199254740992',total:'0.00',unitCost:'0.01'}), RangeError);
  assert.throws(() => saleEconomics({quantity:'9007199254740991',total:'0.00',unitCost:'0.02'}), RangeError);
});

test('economics rejects noncanonical money and never mutates frozen inputs', () => {
  const input = Object.freeze({quantity:'2',total:'0.30',unitCost:'0.10'});
  const first = saleEconomics(input);
  assert.deepEqual(first, {costTotal:'0.20',profit:'0.10',marginBasisPoints:'3333'});
  assert.ok(Object.isFrozen(first));
  assert.deepEqual(saleEconomics(input), first);
  for (const amount of ['-0.01','1,00','0.001','NaN','Infinity','01.00']) {
    assert.throws(() => saleEconomics({quantity:'1',total:amount,unitCost:'0.01'}));
    assert.throws(() => saleEconomics({quantity:'1',total:'1.00',unitCost:amount}));
  }
});

test('oversized sale quantities are rejected before regex scanning or BigInt conversion', () => {
  const oversized = '9'.repeat(1000000);
  assert.throws(() => saleEconomics({ quantity: oversized, total: '1.00', unitCost: '0.01' }), TypeError);
  assert.throws(() => saleEconomics({ quantity: 'x' + oversized, total: '1.00', unitCost: '0.01' }), TypeError);
});


test('basis-point rounding is deterministic at half-up boundaries', () => {
  // 1 cent / 32 cents = 312.5 basis points; ties round away from zero.
  assert.equal(saleEconomics({quantity:'1',total:'0.32',unitCost:'0.31'}).marginBasisPoints, '313');
  // A one-cent loss on 32 cents must use the same rounding policy.
  assert.equal(saleEconomics({quantity:'1',total:'0.32',unitCost:'0.33'}).marginBasisPoints, '-313');
  assert.deepEqual(saleEconomics({quantity:'1',total:'0.00',unitCost:'0.00'}), {
    costTotal:'0.00',profit:'0.00',marginBasisPoints:'0'
  });
});
