"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {filtroCuentaOrigenMutacion}=require(
 "../../modules/finanzas-personales/services/cuentaOrigenMutacionPersonal.service");
const usuarioId="507f1f77bcf86cd799439011";
const cuentaId="507f1f77bcf86cd799439012";
const original={cuentaId,usuarioId,cuenta:"AHORROS",moneda:"COP"};
test("consulta cuenta por identificador original, titular, nombre y moneda",()=>{
 const filtro=filtroCuentaOrigenMutacion(original,usuarioId);
 assert.equal(String(filtro._id),cuentaId);
 assert.equal(filtro.nombre,"AHORROS");
 assert.equal(filtro.usuarioId,usuarioId);
 assert.equal(filtro.moneda,"COP");
 assert.equal(filtro.activa,true);
});
test("falla cerrado cuando falta vínculo bancario original",()=>{
 for(const cambio of [
  {cuentaId:null},{cuentaId:"no-es-objectid"},{cuenta:""},
  {moneda:"USD"},{moneda:null}
 ]){
  assert.throws(()=>filtroCuentaOrigenMutacion({...original,...cambio},usuarioId),
   e=>e.statusCode===409);
 }
});
test("ambos reversos heredados utilizan la misma identidad de cuenta",()=>{
 const source=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/services/flujoCajaPersonal.service.js"),"utf8");
 const inicio=source.indexOf("async function corregirTransaccion");
 const intermedio=source.indexOf("async function anularTransaccion");
 const fin=source.indexOf("module.exports=",intermedio);
 const cor=source.slice(inicio,intermedio),anu=source.slice(intermedio,fin);
 assert.ok(cor.includes("filtroCuentaOrigenMutacion(anterior,usuarioId)"));
 assert.ok(anu.includes("filtroCuentaOrigenMutacion(tx,usuarioId)"));
 assert.ok(cor.includes("...cuentaOriginal,...filtroSaldoSeguro(delta)"));
 assert.ok(anu.includes("...cuentaOriginal,...filtroSaldoSeguro(reverso)"));
 assert.ok(anu.includes("...cuentaOriginal,tipo:\"EFECTIVO\""));
});
