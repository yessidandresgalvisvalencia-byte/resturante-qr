"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {evaluarCandidatoVinculo}=require("../../modules/finanzas-personales/services/diagnosticoVinculosHistoricosV81.service");
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
