"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {deltaCorreccionLegada,deltaAnulacionLegada}=require(
 "../../modules/finanzas-personales/services/deltaMutacionLegadaPersonal.service");
test("un gasto de 25.000 corregido a 22.000 devuelve 3.000 exactos",()=>{
 assert.equal(deltaCorreccionLegada({
  tipoAnterior:"GASTO",montoAnteriorMinor:25000,
  tipoNuevo:"GASTO",montoNuevoMinor:22000
 }),3000);
});
test("cambio de tipo y reversos conservan signos exactos",()=>{
 assert.equal(deltaCorreccionLegada({
  tipoAnterior:"GASTO",montoAnteriorMinor:25000,
  tipoNuevo:"INGRESO",montoNuevoMinor:30000
 }),55000);
 assert.equal(deltaAnulacionLegada({tipo:"GASTO",montoMinor:25000}),25000);
 assert.equal(deltaAnulacionLegada({tipo:"INGRESO",montoMinor:25000}),-25000);
});
test("no acepta overflow de delta aunque los dos importes sean seguros",()=>{
 for(const [a,b] of [[Number.MAX_SAFE_INTEGER,1],
  [Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER]]){
  assert.throws(()=>deltaCorreccionLegada({
   tipoAnterior:"GASTO",montoAnteriorMinor:a,
   tipoNuevo:"INGRESO",montoNuevoMinor:b
  }),e=>e.statusCode===409&&/DELTA_LEGADO_INVALIDO/.test(e.message));
 }
});
test("rechaza importes fraccionarios, negativos, inseguros y tipo ajeno",()=>{
 for(const montoAnteriorMinor of [0,-1,0.1,Number.MAX_SAFE_INTEGER+1]){
  assert.throws(()=>deltaCorreccionLegada({
   tipoAnterior:"GASTO",montoAnteriorMinor,
   tipoNuevo:"GASTO",montoNuevoMinor:25000
  }),e=>e.statusCode===409);
 }
 assert.throws(()=>deltaAnulacionLegada({tipo:"PAGO_DEUDA",montoMinor:25000}),
  e=>e.statusCode===409);
});
test("los métodos heredados llaman helpers exactos antes de tocar caja",()=>{
 const s=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/services/flujoCajaPersonal.service.js"),"utf8");
 const patch=s.slice(s.indexOf("async function corregirTransaccion"),
  s.indexOf("async function anularTransaccion"));
 const borrar=s.slice(s.indexOf("async function anularTransaccion"),
  s.indexOf("module.exports="));
 for(const [tramo,nombre] of [[patch,"deltaCorreccionLegada("],
  [borrar,"deltaAnulacionLegada("]]){
  assert.ok(tramo.includes(nombre));
  assert.ok(tramo.indexOf(nombre)<tramo.indexOf("Cuenta.findOneAndUpdate"));
  assert.ok(tramo.indexOf(nombre)<tramo.indexOf(".save({session})"));
 }
});
