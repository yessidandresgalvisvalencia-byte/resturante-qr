"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {evaluarCandidatoVinculo,evaluarEstadoVinculoHistorico}=require("../../modules/finanzas-personales/services/diagnosticoVinculosHistoricosV81.service");
const cuentas=[{_id:"cuenta-a",nombre:"Nequi",moneda:"COP",activa:true},
 {_id:"cuenta-b",nombre:"Bancolombia",moneda:"COP",activa:true}];
test("un nombre único queda como sugerencia, sin vínculo automático",()=>{
 const x=evaluarCandidatoVinculo({cuentaId:null,cuenta:"Nequi"},cuentas);
 assert.deepEqual(x,{estado:"REQUIERE_CONFIRMACION",cuentaId:"cuenta-a"});
});
test("sin nombre o sin cuenta coincidente no fabrica asociaciones",()=>{
 assert.equal(evaluarCandidatoVinculo({cuentaId:null,cuenta:""},cuentas).estado,"SIN_NOMBRE");
 assert.equal(evaluarCandidatoVinculo({cuentaId:null,cuenta:"Daviplata"},cuentas).estado,"SIN_COINCIDENCIA");
});
test("dos cuentas con mismo nombre son ambiguas",()=>{
 const x=evaluarCandidatoVinculo({cuentaId:null,cuenta:"Nequi"},[cuentas[0],{...cuentas[0],_id:"otra"}]);
 assert.deepEqual(x,{estado:"AMBIGUO",cuentaId:null});
});
test("movimiento previamente vinculado no se reasigna",()=>{
 assert.equal(evaluarCandidatoVinculo({cuentaId:"anterior",cuenta:"Nequi"},cuentas).estado,"YA_VINCULADO");
});
test("cuentas inactivas o de moneda distinta no se sugieren",()=>{
 const x=evaluarCandidatoVinculo({cuentaId:null,cuenta:"Nequi"},[
  {...cuentas[0],activa:false},{...cuentas[0],moneda:"USD"}]);
 assert.equal(x.estado,"SIN_COINCIDENCIA");
});
test("valida entrada malformada",()=>{
 assert.throws(()=>evaluarCandidatoVinculo(null,cuentas),TypeError);
 assert.throws(()=>evaluarCandidatoVinculo({cuenta:"Nequi"},null),TypeError);
});

test("vínculo confirmado se reconoce aunque el nombre apunte a otra cuenta",()=>{
 const mov={_id:"507f1f77bcf86cd799439011",cuentaId:null,cuenta:"Nequi"};
 const vinc={movimientoId:mov._id,cuentaId:"cuenta-b"};
 assert.deepEqual(evaluarEstadoVinculoHistorico(mov,cuentas,vinc),
  {estado:"CONFIRMADO",cuentaId:"cuenta-b"});
 assert.deepEqual(evaluarEstadoVinculoHistorico(mov,cuentas,null),
  {estado:"REQUIERE_CONFIRMACION",cuentaId:"cuenta-a"});
 assert.throws(()=>evaluarEstadoVinculoHistorico(mov,cuentas,{...vinc,movimientoId:"otro"}),e=>e.statusCode===409);
});

test("cursor histórico evita duplicados y saltos de páginas",()=>{
 const {cursorHistoricoValidoV81}=require("../../modules/finanzas-personales/services/diagnosticoVinculosHistoricosV81.service");
 assert.equal(cursorHistoricoValidoV81(undefined),true);
 assert.equal(cursorHistoricoValidoV81("507f1f77bcf86cd799439011"),true);
 for(const cursor of [null,"",[],{},123,"507f1f77bcf86cd79943901g","a".repeat(25)]){
  assert.equal(cursorHistoricoValidoV81(cursor),false);
 }
});

test("consulta histórica bloquea enlaces duplicados aunque uno sea correcto",()=>{
 const {indexarVinculosHistoricosV81}=require("../../modules/finanzas-personales/services/diagnosticoVinculosHistoricosV81.service");
 const id="507f1f77bcf86cd799439011",a="507f1f77bcf86cd799439012",b="507f1f77bcf86cd799439013";
 const unico=indexarVinculosHistoricosV81([{movimientoId:id,cuentaId:a}]);
 assert.equal(String(unico.get(id).cuentaId),a);
 for(const vínculos of [
  [{movimientoId:id,cuentaId:a},{movimientoId:id,cuentaId:b}],
  [{movimientoId:id,cuentaId:a},{movimientoId:id,cuentaId:a}]
 ]){
  assert.throws(()=>indexarVinculosHistoricosV81(vínculos),e=>e.statusCode===409);
 }
 assert.throws(()=>indexarVinculosHistoricosV81([{movimientoId:id,cuentaId:null}]),e=>e.statusCode===409);
});
test("una cuenta fuera del conjunto autorizado nunca se presenta como confirmada",()=>{
 const movimiento={_id:"507f1f77bcf86cd799439011",cuenta:"Nequi",cuentaId:null};
 const vinculo={movimientoId:movimiento._id,cuentaId:"507f1f77bcf86cd799439012"};
 assert.throws(()=>evaluarEstadoVinculoHistorico(movimiento,cuentas,vinculo),e=>e.statusCode===409);
});
