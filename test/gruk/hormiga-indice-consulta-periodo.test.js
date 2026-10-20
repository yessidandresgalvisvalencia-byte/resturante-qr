"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Transaccion=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const {obtener}=require("../../modules/finanzas-personales/services/gastosHormigaResumen.service");

test("índice del resumen filtra por persona, tipo y fecha con prefijo selectivo",()=>{
 const indexes=Transaccion.schema.indexes();
 const coincidentes=indexes.filter(([keys,options])=>
  options.name==="fp_gastos_periodo_usuario_v81");
 assert.equal(coincidentes.length,1);
 assert.deepEqual(coincidentes[0][0],{usuarioId:1,tipo:1,fecha:-1});
 assert.notEqual(coincidentes[0][1].unique,true);
});

test("el resumen aplica usuario y período verificables sin depender de la categoría",async()=>{
 const original=Transaccion.find;
 let filterCaptured;
 let queryLimit;
 Transaccion.find=filter=>{
  filterCaptured=filter;
  return {select(projection){
   assert.match(projection,/\bmoneda\b/);
   return {limit(n){
    queryLimit=n;
    return {lean:async()=>[]};
   }};
  }};
 };
 try{
  const result=await obtener("persona-uno",{ahora:new Date("2026-10-20T15:00:00Z")});
  assert.equal(result.consumoTotalSemanaMinor,0);
  assert.equal(filterCaptured.usuarioId,"persona-uno");
  assert.equal(filterCaptured.tipo,"GASTO");
  assert.deepEqual(filterCaptured.estado,{$ne:"ANULADA"});
  assert.ok(filterCaptured.fecha.$gte instanceof Date);
  assert.ok(filterCaptured.fecha.$lte instanceof Date);
  assert.equal(Object.hasOwn(filterCaptured,"categoria"),false);
  assert.equal(queryLimit,5001);
 }finally{
  Transaccion.find=original;
 }
});
