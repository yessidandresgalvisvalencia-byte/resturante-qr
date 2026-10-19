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

test("un huérfano confirmado para otra cuenta no bloquea esta conciliación",()=>{
 const {filtrarHuerfanosSinResolver}=require("../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service");
 const filas=[{_id:"507f1f77bcf86cd799439011",cuenta:"Nequi",cuentaId:null},
              {_id:"507f1f77bcf86cd799439012",cuenta:"Nequi",cuentaId:null}];
 const vinculados=[{movimientoId:"507f1f77bcf86cd799439011",cuentaId:"507f1f77bcf86cd799439013"}];
 assert.deepEqual(filtrarHuerfanosSinResolver(filas,vinculados),[filas[1]]);
 assert.throws(()=>exigirSinMovimientosHuerfanos({
  cuenta,filas:filtrarHuerfanosSinResolver(filas,vinculados)
 }),e=>e.statusCode===409);
 assert.deepEqual(filtrarHuerfanosSinResolver([filas[0]],vinculados),[]);
 assert.equal(exigirSinMovimientosHuerfanos({
  cuenta,filas:filtrarHuerfanosSinResolver([filas[0]],vinculados)
 }),true);
});

test("períodos inválidos se rechazan sin acceder a saldos",()=>{
 const {fechaCalendarioValidaV81}=require("../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service");
 for(const fecha of ["2026-02-29","2025-02-30","2026-04-31","2026-13-01","2026-00-01","2026-01-00","2026-1-01","texto",""]){
  assert.equal(fechaCalendarioValidaV81(fecha),false,fecha);
 }
 for(const fecha of ["2024-02-29","2026-02-28","2026-12-31","2026-01-01"])
  assert.equal(fechaCalendarioValidaV81(fecha),true,fecha);
});

test("asociaciones incompletas no ocultan un movimiento huérfano",()=>{
 const {filtrarHuerfanosSinResolver}=require("../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service");
 const movimiento={_id:"507f1f77bcf86cd799439011",cuenta:"Nequi",cuentaId:null};
 for(const vinculo of [
  {movimientoId:movimiento._id,cuentaId:null},
  {movimientoId:movimiento._id},
  {movimientoId:movimiento._id,cuentaId:"cuenta-invalida"},
  {movimientoId:"invalido",cuentaId:"507f1f77bcf86cd799439013"}
 ]){
  const sinResolver=filtrarHuerfanosSinResolver([movimiento],[vinculo]);
  assert.deepEqual(sinResolver,[movimiento]);
  assert.throws(()=>exigirSinMovimientosHuerfanos({cuenta,filas:sinResolver}),e=>e.statusCode===409);
 }
});

test("dos vínculos para el mismo movimiento bloquean conciliación aunque uno sea correcto",()=>{
 const {filtrarHuerfanosSinResolver}=require("../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service");
 const id="507f1f77bcf86cd799439011",cuentaA="507f1f77bcf86cd799439013",cuentaB="507f1f77bcf86cd799439014";
 const filas=[{_id:id,cuenta:"Nequi",cuentaId:null}];
 for(const vinculos of [
  [{movimientoId:id,cuentaId:cuentaA},{movimientoId:id,cuentaId:cuentaB}],
  [{movimientoId:id,cuentaId:cuentaA},{movimientoId:id,cuentaId:cuentaA}],
  [{movimientoId:id,cuentaId:null},{movimientoId:id,cuentaId:cuentaA}]
 ]){
  assert.throws(()=>filtrarHuerfanosSinResolver(filas,vinculos),
   e=>e.statusCode===409&&/duplicados o contradictorios/.test(e.message));
 }
 assert.deepEqual(filtrarHuerfanosSinResolver(filas,[{movimientoId:id,cuentaId:cuentaA}]),[]);
});
