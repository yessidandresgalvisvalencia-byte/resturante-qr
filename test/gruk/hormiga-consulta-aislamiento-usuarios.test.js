"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Transaccion=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const {obtener}=require("../../modules/finanzas-personales/services/gastosHormigaResumen.service");
const ahora=new Date("2026-10-20T15:00:00Z");
const fecha=new Date("2026-10-20T10:00:00Z");
const registro=(usuarioId,_id,montoMinor,medioPago)=>({
 usuarioId,_id,fecha,estado:"ACTIVA",tipo:"GASTO",concepto:"Rappi",categoria:"Alimentación",
 montoMinor,medioPago,impactoCaja:medioPago!=="CREDITO"
});
test("consulta real del servicio nunca mezcla cuentas de usuario A y usuario B",async()=>{
 const original=Transaccion.find;
 const datos=[
  registro("usuario-A","mov-A",12500,"DEBITO"),
  registro("usuario-B","mov-B",99000,"CREDITO"),
  registro("usuario-A","mov-A2",8000,"CREDITO")
 ];
 const vistos=[];
 Transaccion.find=filtro=>{
  vistos.push(filtro);
  assert.ok(filtro.usuarioId==="usuario-A"||filtro.usuarioId==="usuario-B");
  assert.equal(filtro.tipo,"GASTO");
  assert.deepEqual(filtro.estado,{$ne:"ANULADA"});
  assert.ok(filtro.fecha.$gte instanceof Date&&filtro.fecha.$lte instanceof Date);
  return {select(campos){
   assert.match(campos,/montoMinor/);
   return {limit(max){assert.equal(max,5001);return {lean:async()=>datos.filter(x=>x.usuarioId===filtro.usuarioId&&x.fecha>=filtro.fecha.$gte&&x.fecha<=filtro.fecha.$lte)};}};
  }};
 };
 try{
  const a=await obtener("usuario-A",{ahora});
  const b=await obtener("usuario-B",{ahora});
  assert.deepEqual([a.semanaMinor,a.creditoSemanaMinor,a.consumoTotalSemanaMinor],[12500,8000,20500]);
  assert.deepEqual([b.semanaMinor,b.creditoSemanaMinor,b.consumoTotalSemanaMinor],[0,99000,99000]);
  assert.equal(vistos.length,2);
  assert.notEqual(vistos[0].usuarioId,vistos[1].usuarioId);
 }finally{Transaccion.find=original;}
});
test("sin identidad verificada no consulta ni devuelve gastos de otro usuario",async()=>{
 const original=Transaccion.find;
 let consultas=0;
 Transaccion.find=()=>{consultas++;throw Error("No debe consultar");};
 try{
  for(const id of [undefined,null,""," ","    ","\t"]){
   await assert.rejects(obtener(id,{ahora}),/identidad autenticada/);
  }
  assert.equal(consultas,0);
 }finally{Transaccion.find=original;}
});

test("respuesta de base con tipo contradictorio o fila nula nunca se convierte en gasto cero",async()=>{
 const original=Transaccion.find;
 let rows=[];
 Transaccion.find=()=>({select(){return {limit(){return {lean:async()=>rows};}};}});
 try{
  for(const row of [null,undefined,{_id:"ingreso",tipo:"INGRESO",concepto:"Rappi",montoMinor:50000},{}]){
   rows=[registro("usuario-A","real",12000,"DEBITO"),row];
   await assert.rejects(obtener("usuario-A",{ahora}),/INTEGRIDAD_HORMIGA: consulta devolvió registros incompletos o tipo contradictorio/);
  }
  rows=[registro("usuario-A","real",12000,"DEBITO")];
  assert.equal((await obtener("usuario-A",{ahora})).semanaMinor,12000);
 }finally{Transaccion.find=original;}
});

test("consulta rechaza filas de otro usuario o sin propietario aunque Mongo reporte éxito",async()=>{
 const original=Transaccion.find;
 let rows=[];
 Transaccion.find=filtro=>({
  select(campos){
   assert.match(campos,/\busuarioId\b/);
   return {limit(){return {lean:async()=>rows};}};
  }
 });
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
 }finally{Transaccion.find=original;}
});
