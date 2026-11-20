"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const consulta=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const {obtener}=require("../../modules/finanzas-personales/services/gastosHormigaResumen.service");
const ahora=new Date("2026-10-20T15:00:00Z");
const fecha=new Date("2026-10-20T10:00:00Z");
const registro=(usuarioId,_id,montoMinor,medioPago)=>({
 usuarioId,_id,fecha,estado:"ACTIVA",tipo:"GASTO",concepto:"Rappi",categoria:"Alimentación",
 montoMinor,medioPago,impactoCaja:medioPago!=="CREDITO"
});
test("consulta real del servicio nunca mezcla cuentas de usuario A y usuario B",async()=>{
 const original=consulta.consultarPeriodo;
 const datos=[
  registro("usuario-A","mov-A",12500,"DEBITO"),
  registro("usuario-B","mov-B",99000,"CREDITO"),
  registro("usuario-A","mov-A2",8000,"CREDITO")
 ];
 const vistos=[];
 consulta.consultarPeriodo=async filtro=>{
  vistos.push(filtro);assert.equal(filtro.tipo,"GASTO");
  return datos.filter(x=>x.usuarioId===filtro.usuarioId&&x.fecha>=new Date(filtro.desde)&&x.fecha<new Date(filtro.hasta));
 };
 try{
  const a=await obtener("usuario-A",{ahora});
  const b=await obtener("usuario-B",{ahora});
  assert.deepEqual([a.semanaMinor,a.creditoSemanaMinor,a.consumoTotalSemanaMinor],[12500,8000,20500]);
  assert.deepEqual([b.semanaMinor,b.creditoSemanaMinor,b.consumoTotalSemanaMinor],[0,99000,99000]);
  assert.equal(vistos.length,2);
  assert.notEqual(vistos[0].usuarioId,vistos[1].usuarioId);
 }finally{consulta.consultarPeriodo=original;}
});
test("sin identidad verificada no consulta ni devuelve gastos de otro usuario",async()=>{
 const original=consulta.consultarPeriodo;
 let consultas=0;
 consulta.consultarPeriodo=()=>{consultas++;throw Error("No debe consultar");};
 try{
  for(const id of [undefined,null,""," ","    ","\t"]){
   await assert.rejects(obtener(id,{ahora}),/identidad autenticada/);
  }
  assert.equal(consultas,0);
 }finally{consulta.consultarPeriodo=original;}
});

test("respuesta de base con tipo contradictorio o fila nula nunca se convierte en gasto cero",async()=>{
 const original=consulta.consultarPeriodo;
 let rows=[];
 consulta.consultarPeriodo=async()=>rows;
 try{
  for(const row of [null,undefined,{_id:"ingreso",tipo:"INGRESO",concepto:"Rappi",montoMinor:50000},{}]){
   rows=[registro("usuario-A","real",12000,"DEBITO"),row];
   await assert.rejects(obtener("usuario-A",{ahora}),/INTEGRIDAD_HORMIGA: consulta devolvió registros incompletos o tipo contradictorio/);
  }
  rows=[registro("usuario-A","real",12000,"DEBITO")];
  assert.equal((await obtener("usuario-A",{ahora})).semanaMinor,12000);
 }finally{consulta.consultarPeriodo=original;}
});

test("consulta rechaza filas de otro usuario o sin propietario aunque Mongo reporte éxito",async()=>{
 const original=consulta.consultarPeriodo;
 let rows=[];
 consulta.consultarPeriodo=async()=>rows;
 try{
  const legítima=registro("usuario-A","mov-A",12500,"DEBITO");
  for(const ajena of [
   registro("usuario-B","mov-B",99000,"CREDITO"),
   {...legítima,_id:"sin-propietario",usuarioId:undefined},
   {...legítima,_id:"nulo",usuarioId:null}
  ]){
   rows=[legítima,ajena];
   await assert.rejects(obtener("usuario-A",{ahora}),/INTEGRIDAD_HORMIGA: movimiento ajeno a la identidad autenticada/);
  }
  rows=[legítima];
  assert.equal((await obtener("usuario-A",{ahora})).semanaMinor,12500);
 }finally{consulta.consultarPeriodo=original;}
});
