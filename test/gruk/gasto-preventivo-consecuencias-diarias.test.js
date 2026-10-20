"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");
const servicePath=path.resolve(__dirname,"../../modules/finanzas-personales/services/gastoInteligentePersonal.service.js");
const homePath=path.resolve(__dirname,"../../modules/finanzas-personales/services/homePersonal.service.js");
const {consecuenciaDiaria}=require(servicePath);
const ahora=new Date("2026-10-20T15:00:00.000Z");
test("compra preventiva divide solo dinero libre en dias civiles de Bogotá con enteros",()=>{
 const r=consecuenciaDiaria({disponibleMinor:25000000,montoMinor:8000000,fechaIngreso:new Date("2026-11-01T05:00:00Z"),ahora});
 assert.deepEqual(r,{restanteMinor:17000000,diasHastaIngreso:12,promedioDiarioMinor:1416666,estimacion:"PROYECCION_NO_PRESUPUESTO"});
 assert.equal(Number.isInteger(r.promedioDiarioMinor),true);
});
test("gasto superior al disponible nunca presenta cupo diario positivo",()=>{
 const r=consecuenciaDiaria({disponibleMinor:3000000,montoMinor:4000000,fechaIngreso:"2026-10-22T05:00:00Z",ahora});
 assert.equal(r.restanteMinor,-1000000);
 assert.equal(r.promedioDiarioMinor,0);
});
test("fecha de ingreso vencida no inventa horizonte de liquidez",()=>{
 const r=consecuenciaDiaria({disponibleMinor:250000,montoMinor:100000,fechaIngreso:"2026-10-19T05:00:00Z",ahora});
 assert.equal(r.diasHastaIngreso,null);assert.equal(r.promedioDiarioMinor,null);
});
test("rechaza dinero en coma flotante, valores negativos y desbordamiento",()=>{
 for(const monto of [0,-1,0.1,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>consecuenciaDiaria({disponibleMinor:250000,montoMinor:monto,fechaIngreso:new Date(),ahora}),/enteros seguros/);
});
test("evaluación nunca autoriza compra si saldo necesita conciliación",async()=>{
 const home=require(homePath);
 const previo=home.obtener;
 home.obtener=async()=>({asesor:{saldoRealConocido:true,aptoParaDisponibleHoy:false,disponibleHoyMinor:null,proximoIngresoConocido:true,proximoIngreso:{fecha:"2026-11-01T05:00:00Z"}}});
 delete require.cache[servicePath];
 try{
  const {evaluar}=require(servicePath);
  const r=await evaluar("cuenta-prueba",{montoMinor:100000});
  assert.equal(r.estado,"FALTAN_DATOS");
  assert.match(r.mensaje,/conciliado/);
 }finally{home.obtener=previo;delete require.cache[servicePath]}
});
