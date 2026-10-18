"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const home=require("../../modules/finanzas-personales/services/homePersonal.service");
const consulta=require("../../modules/finanzas-personales/services/consultaPersonal.service");
test("Consejos de ahorro no anuncian dinero invertible de saldo sin conciliar",async t=>{
 const original=home.obtener;
 home.obtener=async()=>({asesor:{saldoRealConocido:true,saldoConfiabilidad:"RECONSTRUIDO_SIN_ANCLA",saldoRequiereReconciliacion:true,disponibleHoyMinor:999999999}});
 t.after(()=>{home.obtener=original;});
 const result=await consulta.consultar("507f1f77bcf86cd799439011","¿cómo puedo ahorrar mi dinero?");
 assert.equal(result.tipo,"ASESORIA_FINANCIERA_ABIERTA");
 assert.match(result.respuesta,/no tengo un saldo disponible verificado/i);
 assert.doesNotMatch(result.respuesta,/disponible estimado es/i);
});
