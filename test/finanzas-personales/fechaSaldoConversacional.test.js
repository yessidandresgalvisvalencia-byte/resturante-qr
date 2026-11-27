"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {interpretarSegmento}=require("../../modules/finanzas-personales/services/interpreteFinanciero.service");
test("declaraciones de saldo actuales conservan la hora de captura",()=>{
 for(const texto of ["Tengo 312000 pesos en efectivo sin registrar","Tengo 508000 como ahorro que no había registrado"]){
  const antes=Date.now(),x=interpretarSegmento(texto),despues=Date.now();
  assert.ok(["AJUSTE_SALDO","AJUSTE_SALDO_AHORRO"].includes(x.tipo));
  assert.ok(+new Date(x.fecha)>=antes&&+new Date(x.fecha)<=despues);
 }
});
test("saldo declarado ayer o mañana no se convierte en una confirmación de hoy",()=>{
 const ayer=interpretarSegmento("Ayer tengo 312000 pesos en efectivo sin registrar");
 const futuro=interpretarSegmento("Mañana tengo 312000 pesos en efectivo sin registrar");
 assert.ok(+new Date(ayer.fecha)<Date.now());assert.ok(+new Date(futuro.fecha)>Date.now());
});
