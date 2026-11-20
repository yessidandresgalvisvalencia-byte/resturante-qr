"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {metricasExactas}=require("../../modules/finanzas-personales/services/progresoEconomicoPersonal.service");
const row=(tipo,montoMinor,estado="ACTIVA")=>({tipo,montoMinor,estado,categoria:"Gasto hormiga"});
test("progreso suma importes vigentes y excluye anulaciones",()=>{
 const r=metricasExactas([row("INGRESO",10000),row("GASTO",1600),row("GASTO",5000,"ANULADA")],
  [{saldoMinor:300}],{estaEnRojo:true,saldoRealMinor:100,gastosFijosAntesProximoIngresoMinor:200,colchonMinor:10});
 assert.deepEqual(r,{ingresos:10000,gastos:1600,hormiga:1600,porCobrar:300,
  brechaLiquidez:110,ingresoObjetivoMes:10110,superaUmbralHormiga:true});
});
test("umbral de gasto hormiga usa productos enteros exactos",()=>{
 assert.equal(metricasExactas([row("INGRESO",100),row("GASTO",15)],[],{}).superaUmbralHormiga,false);
 assert.equal(metricasExactas([row("INGRESO",Number.MAX_SAFE_INTEGER),row("GASTO",1351079888211149)],[],{}).superaUmbralHormiga,true);
});
test("no se emiten métricas monetarias fuera del rango seguro",()=>{
 const max=Number.MAX_SAFE_INTEGER;
 assert.throws(()=>metricasExactas([row("INGRESO",max),row("INGRESO",1)],[],{}),RangeError);
 assert.throws(()=>metricasExactas([], [{saldoMinor:max},{saldoMinor:1}],{}),RangeError);
 assert.throws(()=>metricasExactas([], [{saldoMinor:1.5}],{}),TypeError);
 assert.throws(()=>metricasExactas([row("INGRESO",max)],[],{
  estaEnRojo:true,saldoRealMinor:0,gastosFijosAntesProximoIngresoMinor:1,colchonMinor:0}),RangeError);
});
