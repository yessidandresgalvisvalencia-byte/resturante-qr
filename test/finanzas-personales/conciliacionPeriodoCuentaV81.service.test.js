"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {conciliarPeriodoCuentaV81}=require("../../modules/finanzas-personales/services/conciliacionPeriodoCuentaV81.service");
const base={usuarioId:"507f1f77bcf86cd799439011",cuentaId:"cuenta-a",saldoInicialCentavos:1000n,saldoObservadoCentavos:900n,desde:"2026-10-01",hastaExclusivo:"2026-11-01"};
const mov={id:"a",tipo:"SALIDA",montoCentavos:100n,fechaContable:"2026-10-17",usuarioId:base.usuarioId,cuentaId:base.cuentaId};
test("V81 concilia período válido y respeta límites inclusivo/exclusivo",()=>{
 const result=conciliarPeriodoCuentaV81({...base,movimientos:[mov]});
 assert.equal(result.estado,"CONCILIADA");assert.equal(result.desde,base.desde);
 for(const fechaContable of ["2026-09-30","2026-11-01","2026-10-35","2026-10-1",undefined]){
  assert.throws(()=>conciliarPeriodoCuentaV81({...base,movimientos:[{...mov,fechaContable}]}),/período/);
 }
});
test("V81 rechaza fechas imposibles y intervalos invertidos",()=>{
 for(const desde of ["2026-02-30","2026-11-01","2026-10-1"]){
  assert.throws(()=>conciliarPeriodoCuentaV81({...base,desde,movimientos:[]}),TypeError);
 }
});
