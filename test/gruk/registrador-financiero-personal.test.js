"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearRegistrador}=require("../../modules/finanzas-personales/services/registradorCompensacionPersonal.service");
const {crearRegistradorFinancieroPersonal}=require("../../modules/finanzas-personales/services/registradorFinancieroPersonal.service");
test("modo financiero no permite registrar eventos sin ajuste atómico",()=>{
 assert.throws(()=>crearRegistrador({exigirAplicacionAtomica:true}),
  e=>e.statusCode===503&&/APLICADOR_ATOMICO_REQUERIDO/.test(e.message));
 assert.throws(()=>crearRegistrador({exigirAplicacionAtomica:true,aplicarAtomico:null}),
  /APLICADOR_ATOMICO_REQUERIDO/);
});
test("fábrica financiera impide deshabilitar el aplicador o reemplazarlo directamente",()=>{
 for(const opciones of [
  {aplicarAtomico:null},{aplicarAtomico:async()=>{}},
  {exigirAplicacionAtomica:false},{crearAplicador:null},
  {crearAplicador:()=>null}
 ])assert.throws(()=>crearRegistradorFinancieroPersonal(opciones),
  /aplicación financiera no modificable|APLICADOR_ATOMICO_REQUERIDO/);
});
test("fábrica financiera construye registrador cuando se dispone de aplicador",()=>{
 let invocaciones=0;
 const registrar=crearRegistradorFinancieroPersonal({
  crearAplicador:()=>{invocaciones++;return async()=>{};}
 });
 assert.equal(typeof registrar,"function");
 assert.equal(invocaciones,1);
});
