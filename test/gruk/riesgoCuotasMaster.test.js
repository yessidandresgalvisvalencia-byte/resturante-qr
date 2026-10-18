"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {diagnosticarRiesgoCuotas}=require("../../modules/finanzas-personales/services/riesgoCuotasMaster.service");
test("saldo no verificado jamás autoriza cuotas",()=>{
 const r=diagnosticarRiesgoCuotas({cuotas:[145600,145600],disponibleHoyMinor:300000,saldoVerificado:false});
 assert.equal(r.diagnostico,"INFORMACION_INSUFICIENTE");assert.equal(r.cubrePrimeraCuota,null);
});
test("liquidez para primera cuota no demuestra flujo futuro",()=>{
 const r=diagnosticarRiesgoCuotas({cuotas:[145600,145600],disponibleHoyMinor:200000,saldoVerificado:true});
 assert.equal(r.cubrePrimeraCuota,true);assert.equal(r.diagnostico,"INFORMACION_INSUFICIENTE");
});
test("flujo deficitario genera riesgo alto",()=>{
 const r=diagnosticarRiesgoCuotas({cuotas:[145600,145600],disponibleHoyMinor:200000,saldoVerificado:true,ingresoMensualLibreMinor:200000,cuotasExistentesMinor:100000});
 assert.equal(r.diagnostico,"RIESGO_ALTO");assert.equal(r.margenMensualMinor,-45600);
});
test("rechazar valores no seguros",()=>assert.throws(()=>diagnosticarRiesgoCuotas({cuotas:[-1]}),TypeError));