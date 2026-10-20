"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const servicio=path.resolve(__dirname,"../../modules/finanzas-personales/services/gastoInteligentePersonal.service.js");
const home=require("../../modules/finanzas-personales/services/homePersonal.service");
const {alertarVencimientoProximo}=require(servicio);
const ahora=new Date("2026-10-20T15:00:00Z");
const ingreso="2026-11-01T05:00:00Z";
function c(concepto,montoMinor,fecha){return{concepto,montoMinor,fecha};}
test("obligación de arriendo antes de cobrar activa alerta con días y monto exactos",()=>{
 const alerta=alertarVencimientoProximo({compromisos:[c("Arriendo",80000000,"2026-10-22T05:00:00Z")],fechaIngreso:ingreso,ahora});
 assert.deepEqual(alerta,{tipo:"VENCIMIENTO_PROXIMO",prioridad:"ALTA",concepto:"Arriendo",montoMinor:80000000,diasRestantes:2,descripcion:"El compromiso ya se descontó al calcular Disponible Hoy; no es un cobro adicional."});
});
test("no alerta sobre obligación pagada, inválida, después del ingreso o posterior a siete días",()=>{
 const alerta=alertarVencimientoProximo({compromisos:[
  c("pagado",0,"2026-10-21T05:00:00Z"),
  c("futuro",50000,"2026-11-02T05:00:00Z"),
  c("sin dato",null,"2026-10-21T05:00:00Z"),
  c("fuera ventana",25000,"2026-10-29T05:00:00Z")
 ],fechaIngreso:ingreso,ahora});
 assert.equal(alerta,null);
});
test("elige primero el vencimiento más cercano sin sumar ni duplicar compromisos",()=>{
 const alerta=alertarVencimientoProximo({compromisos:[
  c("Internet",1000000,"2026-10-25T05:00:00Z"),
  c("Mercado",2500000,"2026-10-21T05:00:00Z")
 ],fechaIngreso:ingreso,ahora});
 assert.equal(alerta.concepto,"Mercado");
 assert.equal(alerta.montoMinor,2500000);
 assert.equal(alerta.diasRestantes,1);
});
test("evaluación solo lectura integra advertencia de compromiso protegido sin alterar Disponible Hoy",async()=>{
 const original=home.obtener;
 const fechaProxima=new Date(Date.now()+12*86400000).toISOString();
 const fechaArriendo=new Date(Date.now()+2*86400000).toISOString();
 home.obtener=async()=>({asesor:{
  aptoParaDisponibleHoy:true,disponibleHoyMinor:25000000,proximoIngresoConocido:true,
  proximoIngreso:{fecha:fechaProxima},
  compromisosAntesProximoIngreso:[c("Arriendo",80000000,fechaArriendo)]
 }});
 delete require.cache[servicio];
 try{
  const {evaluar}=require(servicio);
  const r=await evaluar("ensayo",{montoMinor:8000000});
  assert.equal(r.estado,"CABE");
  assert.equal(r.restanteMinor,17000000);
  assert.equal(r.alerta?.montoMinor,80000000);
  assert.match(r.mensaje,/Arriendo/);
  assert.match(r.mensaje,/ya está separado del disponible/);
 }finally{home.obtener=original;delete require.cache[servicio];}
});
