'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {calcularImportePagoCentavos}=require('../../services/p0/calcularImportePago');
test('suma valores en COP sin redondear entradas ambiguas',()=>{
 assert.equal(calcularImportePagoCentavos([{precio:1000},{precio:2500}]),350000);
});
test('rechaza strings y conversiones silenciosas',()=>{
 for(const precio of ['1000',null,{},NaN,Infinity,1.25,-1,0])assert.throws(()=>calcularImportePagoCentavos([{precio}]),{statusCode:409});
});
test('rechaza arreglos vacios',()=>{
 assert.throws(()=>calcularImportePagoCentavos([]),{statusCode:409});
});
test('rechaza overflow al convertir y sumar centavos',()=>{
 assert.throws(()=>calcularImportePagoCentavos([{precio:Number.MAX_SAFE_INTEGER}]),{statusCode:409});
 const p=Math.floor(Number.MAX_SAFE_INTEGER/100);
 assert.throws(()=>calcularImportePagoCentavos([{precio:p},{precio:p}]),{statusCode:409});
});
