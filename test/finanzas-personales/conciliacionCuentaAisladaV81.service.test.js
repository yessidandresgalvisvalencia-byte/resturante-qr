"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {conciliarCuentaAisladaV81}=require("../../modules/finanzas-personales/services/conciliacionCuentaAisladaV81.service");
const usuarioId="507f1f77bcf86cd799439011";
const base={usuarioId,cuentaId:"ahorro-uno",saldoInicialCentavos:100000n,saldoObservadoCentavos:90000n};
test("V81 concilia únicamente movimientos de la cuenta y usuario indicados",()=>{
 const x=conciliarCuentaAisladaV81({...base,movimientos:[{usuarioId,cuentaId:"ahorro-uno",id:"gasto-1",tipo:"SALIDA",montoCentavos:10000n}]});
 assert.equal(x.estado,"CONCILIADA");assert.equal(x.cuentaId,"ahorro-uno");
});
test("V81 rechaza movimientos de otras cuentas, ajenos o sin cuenta",()=>{
 for(const alterado of [{cuentaId:"otra"},{usuarioId:"507f191e810c19729de860ea"},{cuentaId:undefined}]){
  assert.throws(()=>conciliarCuentaAisladaV81({...base,movimientos:[{usuarioId,cuentaId:"ahorro-uno",id:"gasto-1",tipo:"SALIDA",montoCentavos:10000n,...alterado}]}),/bloqueada/);
 }
 assert.throws(()=>conciliarCuentaAisladaV81({...base,cuentaId:"",movimientos:[]}),TypeError);
});
