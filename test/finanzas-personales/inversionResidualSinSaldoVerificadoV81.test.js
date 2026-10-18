"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const home=require("../../modules/finanzas-personales/services/homePersonal.service");
const ledger=require("../../modules/finanzas-personales/services/resumenLedgerPersonal.service");
const consulta=require("../../modules/finanzas-personales/services/consultaPersonal.service");
test("Ruta residual de inversión no expone monto desde saldo no verificado",async t=>{
 const original=home.obtener, originalResumen=ledger.resumen;
 ledger.resumen=async()=>({ingresosMinor:0,gastosMinor:0,pagosDeudaMinor:0,flujoLibreMinor:0});
 home.obtener=async()=>({asesor:{saldoRealConocido:true,saldoConfiabilidad:"RECONSTRUIDO_SIN_ANCLA",saldoRequiereReconciliacion:true,disponibleHoyMinor:9000000}});
 t.after(()=>{home.obtener=original;ledger.resumen=originalResumen;});
 const respuesta=await consulta.consultar("507f1f77bcf86cd799439011","quiero invertir");
 assert.equal(respuesta.tipo,"INVERSION");
 assert.equal(respuesta.datos.aptoParaInversion,false);
 assert.doesNotMatch(respuesta.respuesta,/tienes.*disponibles/i);
});
