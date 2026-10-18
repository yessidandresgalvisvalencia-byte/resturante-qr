"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {filtroSaldoSeguro}=require("../../modules/finanzas-personales/services/limitesSaldoPersonal.service");
const MAX=Number.MAX_SAFE_INTEGER,MIN=Number.MIN_SAFE_INTEGER;
function permitido(saldo,delta,opciones){
 const rango=filtroSaldoSeguro(delta,opciones).saldoMinor;
 return saldo>=rango.$gte&&saldo<=rango.$lte;
}
test("ingreso no puede superar el máximo entero seguro",()=>{
 assert.equal(permitido(MAX-100,100),true);
 assert.equal(permitido(MAX-99,100),false);
 assert.equal(permitido(100,100),true);
});
test("gasto normal no puede dejar caja negativa",()=>{
 assert.equal(permitido(100,100),true);
 assert.equal(permitido(100,-100),true);
 assert.equal(permitido(99,-100),false);
});
test("efectivo histórico puede ser negativo, pero no desbordarse",()=>{
 assert.equal(permitido(0,-100,{permitirNegativo:true}),true);
 assert.equal(permitido(MIN+100,-100,{permitirNegativo:true}),true);
 assert.equal(permitido(MIN+99,-100,{permitirNegativo:true}),false);
 assert.equal(permitido(MAX,1,{permitirNegativo:true}),false);
});
test("la validación monetaria rechaza fracciones e importes inseguros",()=>{
 for(const delta of [0.1,NaN,Infinity,MAX+1,MIN-1])
  assert.throws(()=>filtroSaldoSeguro(delta),e=>e.statusCode===400);
});
test("el límite superior e inferior se calculan sin fracciones",()=>{
 const a=filtroSaldoSeguro(100);
 assert.deepEqual(a,{saldoMinor:{$gte:0,$lte:MAX-100}});
 const b=filtroSaldoSeguro(-100,{permitirNegativo:true});
 assert.deepEqual(b,{saldoMinor:{$gte:MIN+100,$lte:MAX}});
});
