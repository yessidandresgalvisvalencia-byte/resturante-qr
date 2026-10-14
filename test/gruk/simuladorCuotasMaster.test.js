"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {simularCuotas,interpretarSimulacion}=require("../../modules/finanzas-personales/services/simuladorCuotasMaster.service");
test("zapatos COP 280000 dos cuotas al 4 por ciento sobre cada cuota",()=>{
 const d=interpretarSimulacion("Quiero comprar zapatos que valen 280 mil a 2 cuotas, me cobran 4%");
 assert.deepEqual(d,{precio:280000,numeroCuotas:2,tasaPct:4});
 const r=simularCuotas(d);
 assert.equal(r.total,291200);assert.equal(r.intereses,11200);assert.deepEqual(r.cuotas,[145600,145600]);
});
test("interés sobre saldo decreciente distinto del interés aplicado a cada cuota",()=>{
 const r=simularCuotas({precio:280000,numeroCuotas:2,tasaPct:4,metodo:"SALDO_DECRECIENTE"});
 assert.ok(r.total>291200);assert.equal(r.cuotas.length,2);
});
test("no se acepta capital, tasa o plazo inválido",()=>{
 assert.throws(()=>simularCuotas({precio:-1,numeroCuotas:2,tasaPct:4}),RangeError);
 assert.throws(()=>simularCuotas({precio:1000,numeroCuotas:0,tasaPct:4}),RangeError);
 assert.throws(()=>simularCuotas({precio:1000,numeroCuotas:2,tasaPct:NaN}),RangeError);
 assert.equal(interpretarSimulacion("Quiero comprar algo"),null);
});