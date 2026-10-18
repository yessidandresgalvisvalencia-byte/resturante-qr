"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {conciliarCuentaV81}=require("../../modules/finanzas-personales/services/conciliacionCuentaV81.service");
const {conciliarCuentaAisladaV81}=require("../../modules/finanzas-personales/services/conciliacionCuentaAisladaV81.service");
const {conciliarPeriodoCuentaV81}=require("../../modules/finanzas-personales/services/conciliacionPeriodoCuentaV81.service");
const usuarioId="507f1f77bcf86cd799439011",cuentaId="507f1f77bcf86cd799439012";
const mov=(id,tipo,montoCentavos,fechaContable="2025-01-15")=>({
 id,usuarioId,cuentaId,tipo,montoCentavos,fechaContable
});
test("conciliación COP conserva cada centavo mediante BigInt",()=>{
 const r=conciliarCuentaV81({
  saldoInicialCentavos:100n,
  saldoObservadoCentavos:130n,
  movimientos:[{id:"a",tipo:"ENTRADA",montoCentavos:10n},
   {id:"b",tipo:"ENTRADA",montoCentavos:20n}]
 });
 assert.deepEqual(r,{estado:"CONCILIADA",saldoEsperadoCentavos:"130",
  diferenciaCentavos:"0",movimientosEvaluados:2});
});
test("un movimiento duplicado se bloquea incluso si los totales coinciden",()=>{
 const base={saldoInicialCentavos:10000n,saldoObservadoCentavos:9000n};
 assert.throws(()=>conciliarCuentaV81({...base,movimientos:[
  {id:"mismo",tipo:"SALIDA",montoCentavos:500n},
  {id:"mismo",tipo:"SALIDA",montoCentavos:500n}
 ]}),/duplicado/);
});
test("la cantidad esperada protege contra omisiones silenciosas",()=>{
 assert.throws(()=>conciliarCuentaAisladaV81({
  usuarioId,cuentaId,saldoInicialCentavos:0n,saldoObservadoCentavos:0n,
  movimientos:[],cantidadEsperadaMovimientos:1
 }),/incompleta/);
});
test("movimientos de otra cuenta u otro usuario nunca se mezclan",()=>{
 const entrada=mov("uno","ENTRADA",500n);
 for(const falso of [{...entrada,cuentaId:"507f1f77bcf86cd799439013"},
  {...entrada,usuarioId:"507f1f77bcf86cd799439014"},
  {...entrada,cuentaId:null}]){
  assert.throws(()=>conciliarCuentaAisladaV81({
   usuarioId,cuentaId,movimientos:[falso],saldoInicialCentavos:0n,
   saldoObservadoCentavos:500n
  }),/ajeno o sin cuenta/);
 }
});
test("movimiento fuera del mes o fecha imposible nunca contamina resultado",()=>{
 const base={usuarioId,cuentaId,desde:"2025-01-01",hastaExclusivo:"2025-02-01",
  saldoInicialCentavos:0n,saldoObservadoCentavos:500n};
 for(const fecha of ["2024-12-31","2025-02-01","2025-02-30"]){
  assert.throws(()=>conciliarPeriodoCuentaV81({...base,
   movimientos:[mov("uno","ENTRADA",500n,fecha)]}),/fuera del período/);
 }
 assert.equal(conciliarPeriodoCuentaV81({...base,
  movimientos:[mov("uno","ENTRADA",500n,"2025-01-31")]}).estado,"CONCILIADA");
});
