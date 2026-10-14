"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {calendarioObligacion}=require("../../modules/finanzas-personales/services/calendarioObligacionMaster.service");
const base={_id:"a",concepto:"Compra financiada",fechaVencimiento:"2026-10-15T05:00:00Z",saldoMinor:4500000,cuotaMinor:1000000,periodicidad:"MENSUAL",diaPago:15,periodicidadConfirmada:true};
test("obligación mensual se limita al saldo y termina con cuota parcial",()=>{
 const r=calendarioObligacion(base,new Date("2026-10-13T05:00:00Z"),180);
 assert.deepEqual(r.map(x=>x.montoMinor),[1000000,1000000,1000000,1000000,500000]);
 assert.equal(r.reduce((a,x)=>a+x.montoMinor,0),4500000);
});
test("sin confirmación no inventa recurrencia",()=>{
 assert.deepEqual(calendarioObligacion({...base,periodicidadConfirmada:false}),[]);
});
test("frecuencia semanal y única independientes del concepto",()=>{
 const d={...base,concepto:"Arriendo",periodicidad:"SEMANAL",saldoMinor:3000,cuotaMinor:1000};
 assert.equal(calendarioObligacion(d,new Date("2026-10-13T05:00:00Z"),40).length,3);
 assert.equal(calendarioObligacion({...d,periodicidad:"UNICA"},new Date("2026-10-13T05:00:00Z"),40).length,1);
});
test("fecha mensual 31 se adapta a febrero",()=>{
 const r=calendarioObligacion({...base,fechaVencimiento:"2027-01-31T05:00:00Z",diaPago:31},new Date("2027-01-30T05:00:00Z"),70);
 assert.deepEqual(r.slice(0,3).map(x=>x.fecha.toISOString().slice(0,10)),["2027-01-31","2027-02-28","2027-03-31"]);
});