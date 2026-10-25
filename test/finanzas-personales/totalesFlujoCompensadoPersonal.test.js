"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {calcularFlujo}=require("../../modules/finanzas-personales/services/totalesFlujoCompensadoPersonal.service");
const row=(tipo,montoMinor,estado="ACTIVA")=>({tipo,montoMinor,estado});
test("flujo excluye anulaciones y preserva préstamos solo en el informe correspondiente",()=>{
 const rows=[row("INGRESO",100000),row("GASTO",22000),row("PAGO_DEUDA",5000),row("GASTO",25000,"ANULADA"),row("PRESTAMO_RECIBIDO",20000),row("PRESTAMO_OTORGADO",1000)];
 assert.equal(calcularFlujo(rows).flujoNetoMinor,73000);
 assert.equal(calcularFlujo(rows,{incluirPrestamos:true}).flujoNetoMinor,92000);
});
test("acumula con BigInt y rechaza desbordes, floats y estado incierto",()=>{
 const max=Number.MAX_SAFE_INTEGER;
 assert.equal(calcularFlujo([row("INGRESO",max),row("GASTO",max-1)]).flujoNetoMinor,1);
 assert.throws(()=>calcularFlujo([row("INGRESO",max),row("INGRESO",1)]),/rango seguro/);
 assert.throws(()=>calcularFlujo([row("GASTO",1.1)]),/inseguro/);
 assert.throws(()=>calcularFlujo([row("GASTO",5,"DESCONOCIDA")]),/Estado/);
});
