"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {exigirSinMovimientosHuerfanos}=require("../../modules/finanzas-personales/services/guardiaConciliacionCuentaV81.service");
const cuenta={nombre:"Nequi"};
test("conciliación sin asientos huérfanos continúa",()=>{
 assert.equal(exigirSinMovimientosHuerfanos({cuenta,filas:[]}),true);
 assert.equal(exigirSinMovimientosHuerfanos({cuenta,filas:[{cuenta:"Bancolombia",cuentaId:null}]}),true);
});
test("un asiento sin cuentaId de la misma cuenta bloquea falso cuadrado",()=>{
 assert.throws(()=>exigirSinMovimientosHuerfanos({
  cuenta,filas:[{cuenta:"Nequi",cuentaId:null,montoMinor:25000}]
 }),e=>e.statusCode===409&&/sin cuentaId/.test(e.message));
});
test("filas malformadas no se interpretan como conciliación válida",()=>{
 assert.throws(()=>exigirSinMovimientosHuerfanos({cuenta,filas:null}),TypeError);
 assert.throws(()=>exigirSinMovimientosHuerfanos({cuenta:{},filas:[]}),TypeError);
});
test("registro nuevo siempre vincula cuenta antes del asiento",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const fuente=fs.readFileSync(path.join(__dirname,"../../modules/finanzas-personales/services/flujoCajaPersonal.service.js"),"utf8");
 const inicio=fuente.indexOf("async function registrarTransaccion(");
 const fin=fuente.indexOf("async function publicarEvento(",inicio);
 const bloque=fuente.slice(inicio,fin);
 assert.ok(bloque.indexOf("const nombreCuenta=")>0);
 assert.ok(bloque.indexOf("const nombreCuenta=")<bloque.indexOf("[tx]=await Transaccion.create("));
 assert.match(bloque,/recurrenteOrigenId,cuentaId:cuenta\._id,tipo:input\.tipo/);
});
