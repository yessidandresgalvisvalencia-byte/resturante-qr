"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const home=require("../../modules/finanzas-personales/services/homePersonal.service");
const consulta=require("../../modules/finanzas-personales/services/consultaPersonal.service");
test("Meta de ingresos no calcula margen libre con saldo sin ancla",async t=>{
 const original=home.obtener;
 home.obtener=async()=>({asesor:{saldoRealConocido:true,saldoConfiabilidad:"RECONSTRUIDO_SIN_ANCLA",saldoRealMinor:8000000},caja:{comprometidoMinor:0}});
 t.after(()=>{home.obtener=original;});
 const result=await consulta.consultar("507f1f77bcf86cd799439011","¿cuánto ingreso necesito para gastar bien?");
 assert.equal(result.tipo,"META_INGRESOS_PARA_GASTAR");
 assert.equal(result.datos.aptoParaDisponibleHoy,false);
 assert.equal(result.datos.requiereReconciliacion,true);
 assert.equal(result.datos.margenLibreProtegidoMinor,undefined);
});
