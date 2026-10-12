'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {calcularReintentoMs}=require('../../services/p0/conciliarPendientesWompi');
test('Wompi reconciliation backoff grows exponentially and is capped',()=>{
 assert.equal(calcularReintentoMs(1),30000);
 assert.equal(calcularReintentoMs(2),60000);
 assert.equal(calcularReintentoMs(3),120000);
 assert.equal(calcularReintentoMs(8),1920000);
 assert.equal(calcularReintentoMs(100),1920000);
});
