"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {importes}=require("../../modules/finanzas-personales/services/compromisosCuotas.service");
test("genera exactamente N cuotas sin pérdida de redondeo",()=>{
 const a=importes(1000001,3);
 assert.equal(a.length,3);assert.equal(a.reduce((x,y)=>x+y,0),1000001);
 assert.ok(a.every(x=>Number.isSafeInteger(x)&&x>0));
});
test("cuotas no pueden exceder monto ni superar 360",()=>{
 assert.throws(()=>importes(2,3));
 assert.throws(()=>importes(1000000,361));
});
test("compra de 4500000 en 5 cuotas exactas",()=>{
 assert.deepEqual(importes(4500000,5),[900000,900000,900000,900000,900000]);
});