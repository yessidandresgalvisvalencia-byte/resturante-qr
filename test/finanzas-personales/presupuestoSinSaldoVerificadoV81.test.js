"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const home=require("../../modules/finanzas-personales/services/homePersonal.service");
const consulta=require("../../modules/finanzas-personales/services/consultaPersonal.service");
test("Consejo de presupuesto no anuncia liquidez libre si saldo requiere conciliación",async t=>{
 const original=home.obtener;
 home.obtener=async()=>({asesor:{saldoRealConocido:true,saldoConfiabilidad:"RECONSTRUIDO_SIN_ANCLA",saldoRequiereReconciliacion:true,disponibleHoyMinor:9999999}});
 t.after(()=>{home.obtener=original;});
 const result=await consulta.consultar("507f1f77bcf86cd799439011","¿qué me recomiendas para mi presupuesto?");
 assert.equal(result.tipo,"ASESORIA_PLANIFICACION");
 assert.equal(result.datos.disponibleMinor,null);
});
