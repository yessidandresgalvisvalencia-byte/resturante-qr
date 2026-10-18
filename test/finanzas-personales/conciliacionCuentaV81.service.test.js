"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {conciliarCuentaV81}=require("../../modules/finanzas-personales/services/conciliacionCuentaV81.service");
test("Concilia caja exacta con ancla y movimientos por cuenta",()=>{
 const x=conciliarCuentaV81({saldoInicialCentavos:100000n,movimientos:[{id:"salario",tipo:"ENTRADA",montoCentavos:300050n},{id:"arriendo",tipo:"SALIDA",montoCentavos:150025n}],saldoObservadoCentavos:250025n});
 assert.deepEqual(x,{estado:"CONCILIADA",saldoEsperadoCentavos:"250025",diferenciaCentavos:"0",movimientosEvaluados:2});
 const y=conciliarCuentaV81({saldoInicialCentavos:100000n,movimientos:[],saldoObservadoCentavos:99999n});
 assert.equal(y.estado,"DIFERENCIA");assert.equal(y.diferenciaCentavos,"-1");
});
test("No inventa saldo inicial, transferencias ni impactos de crédito",()=>{
 assert.throws(()=>conciliarCuentaV81({movimientos:[],saldoObservadoCentavos:0n}),TypeError);
 assert.throws(()=>conciliarCuentaV81({saldoInicialCentavos:0n,movimientos:[{id:"x",tipo:"CREDITO",montoCentavos:1n}],saldoObservadoCentavos:0n}),/no clasificado/);
 assert.throws(()=>conciliarCuentaV81({saldoInicialCentavos:0n,movimientos:[{id:"x",tipo:"ENTRADA",montoCentavos:1n},{id:"x",tipo:"SALIDA",montoCentavos:1n}],saldoObservadoCentavos:0n}),/duplicado/);
});
