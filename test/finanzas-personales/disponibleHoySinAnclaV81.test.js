"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const home=require("../../modules/finanzas-personales/services/homePersonal.service");
const consulta=require("../../modules/finanzas-personales/services/consultaPersonal.service");
test("Disponible Hoy no recomienda gastar sobre saldo reconstruido sin ancla",async t=>{
 const previo=home.obtener;
 home.obtener=async()=>({asesor:{saldoRealConocido:true,saldoConfiabilidad:"RECONSTRUIDO_SIN_ANCLA",saldoRealMinor:99999999}});
 t.after(()=>{home.obtener=previo;});
 const r=await consulta.consultar("507f1f77bcf86cd799439011","¿cuánto puedo gastar hoy?");
 assert.equal(r.tipo,"DISPONIBLE_HOY");
 assert.equal(r.datos.aptoParaDisponibleHoy,false);
 assert.equal(r.datos.requiereReconciliacion,true);
 assert.doesNotMatch(r.respuesta,/puedes gastar hasta|hoy puedes gastar [0-9]/i);
});
