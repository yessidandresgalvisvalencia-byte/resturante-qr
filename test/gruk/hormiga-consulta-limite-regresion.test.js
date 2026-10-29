"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const consulta=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const {obtener}=require("../../modules/finanzas-personales/services/gastosHormigaResumen.service");
const ahora=new Date("2026-10-20T15:00:00Z");
const tx=i=>({_id:String(i),usuarioId:"persona-1",tipo:"GASTO",concepto:"Rappi",categoria:"Alimentación",montoMinor:100,
 medioPago:"DEBITO",impactoCaja:true,estado:"ACTIVA",fecha:new Date("2026-10-20T10:00:00Z")});
test("consulta limita documentos y nunca devuelve total truncado",async()=>{
 const original=consulta.consultarPeriodo;
 consulta.consultarPeriodo=async filtro=>{
  assert.equal(filtro.usuarioId,"persona-1");assert.equal(filtro.tipo,"GASTO");
  return Array.from({length:5001},(_,i)=>tx(i));
 };
 try{
  await assert.rejects(obtener("persona-1",{ahora}),/consulta excede límite verificable/);
 }finally{consulta.consultarPeriodo=original;}
});
test("exactamente 5000 movimientos reales permiten un cálculo completo",async()=>{
 const original=consulta.consultarPeriodo;
 consulta.consultarPeriodo=async()=>Array.from({length:5000},(_,i)=>tx(i));
 try{
  const r=await obtener("persona-1",{ahora});
  assert.equal(r.semanaMinor,500000);
  assert.equal(r.mesMinor,500000);
  assert.equal(r.movimientosSemana,5000);
 }finally{consulta.consultarPeriodo=original;}
});
test("consulta incompleta o inesperada nunca se presenta como cero",async()=>{
 const original=consulta.consultarPeriodo;
 consulta.consultarPeriodo=async()=>null;
 try{await assert.rejects(obtener("persona-1",{ahora}),/consulta excede límite verificable/);}
 finally{consulta.consultarPeriodo=original;}
});
