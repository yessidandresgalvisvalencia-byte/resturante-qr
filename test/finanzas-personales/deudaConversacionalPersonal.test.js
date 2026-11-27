"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validarDeudaConversacional:validar}=require("../../modules/finanzas-personales/services/deudaConversacionalPersonal.service");
const {calendarioDeudaConversacional:calendario}=require("../../modules/finanzas-personales/services/deudaConversacionalPersonal.service");
test("sin día explícito no se inventa vencimiento",()=>{
 assert.equal(calendario({cuotaMinor:200}).fechaVencimiento,null);
 assert.equal(calendario({diaPago:15,cuotaMinor:0}).periodicidadConfirmada,false);
});
test("calendario usa el día colombiano y conserva vencimientos de hoy",()=>{
 const x={diaPago:31,cuotaMinor:200,frecuencia:"MENSUAL"};
 assert.equal(calendario(x,new Date("2026-03-01T02:00:00Z")).fechaVencimiento.toISOString(),"2026-02-28T17:00:00.000Z");
 assert.equal(calendario({diaPago:29,cuotaMinor:200},new Date("2026-10-29T23:00:00Z")).fechaVencimiento.toISOString(),"2026-10-29T17:00:00.000Z");
 assert.equal(calendario({diaPago:5,cuotaMinor:200},new Date("2026-12-31T20:00:00Z")).fechaVencimiento.toISOString(),"2027-01-05T17:00:00.000Z");
 assert.throws(()=>calendario({diaPago:32}),e=>e.statusCode===422);
});
test("deuda conserva capital, saldo y abono exactos sin inventar interés",()=>{
 const r=validar({montoMinor:1000,saldoMinor:600,abonadoMinor:400,cuotaMinor:200});
 assert.equal(r.principalMinor,1000);assert.equal(r.saldoMinor,600);assert.equal(r.tasaConfirmada,false);
 assert.equal(validar({montoMinor:1000,saldoMinor:0,abonadoMinor:1000,tasaMensualPct:0}).estado,"PAGADO");
});
test("deuda rechaza fracciones, desbordamientos, abonos contradictorios y tasas inválidas",()=>{
 for(const cambio of [{principalMinor:1.5},{principalMinor:0},{saldoMinor:1001},{saldoMinor:-1},
  {cuotaMinor:1.5},{abonadoMinor:100},{montoMinor:Number.MAX_SAFE_INTEGER+1},{tasaMensualPct:Infinity}])
  assert.throws(()=>validar({montoMinor:1000,saldoMinor:600,abonadoMinor:400,...cambio}),e=>e.statusCode===422);
});
