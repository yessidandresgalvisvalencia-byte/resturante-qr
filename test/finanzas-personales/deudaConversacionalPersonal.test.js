"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validarDeudaConversacional:validar}=require("../../modules/finanzas-personales/services/deudaConversacionalPersonal.service");
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
