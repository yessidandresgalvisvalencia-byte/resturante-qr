"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {proyectarSaldoV81,conciliarContraReferenciaV81}=require("../../modules/finanzas-personales/services/conciliacionV81.service");
test("V81 concilia exacto 0.1 + 0.2 = 0.3 sin flotantes",()=>{
 const x=proyectarSaldoV81([{id:"a",tipo:"INGRESO",montoCentavos:10n},{id:"b",tipo:"INGRESO",montoCentavos:20n}]);
 assert.equal(x.saldoCentavos,30n);
 assert.equal(conciliarContraReferenciaV81(x,30n).coincide,true);
 assert.equal(conciliarContraReferenciaV81(x,29n).diferenciaCentavos,1n);
});
test("V81 anulación revierte exactamente ingreso o gasto una sola vez",()=>{
 const x=proyectarSaldoV81([{id:"a",tipo:"INGRESO",montoCentavos:100000n},{id:"b",tipo:"GASTO",montoCentavos:25001n},{id:"c",tipo:"ANULACION",corrigeId:"b",montoCentavos:0n}]);
 assert.equal(x.saldoCentavos,100000n);assert.equal(x.gastosCentavos,0n);
 assert.throws(()=>proyectarSaldoV81([{id:"a",tipo:"INGRESO",montoCentavos:1n},{id:"b",tipo:"ANULACION",corrigeId:"a",montoCentavos:0n},{id:"c",tipo:"ANULACION",corrigeId:"a",montoCentavos:0n}]),/Anulación/);
});
test("V81 no inventa el significado de correcciones ni movimientos inválidos",()=>{
 assert.throws(()=>proyectarSaldoV81([{id:"x",tipo:"CORRECCION",montoCentavos:1n}]),/no implementada/);
 assert.throws(()=>proyectarSaldoV81([{id:"x",tipo:"GASTO",montoCentavos:1.1}]),TypeError);
 assert.throws(()=>proyectarSaldoV81([{id:"x",tipo:"INGRESO",montoCentavos:1n},{id:"x",tipo:"GASTO",montoCentavos:1n}]),/duplicado/);
 assert.throws(()=>conciliarContraReferenciaV81({saldoCentavos:0n},0),TypeError);
});
