"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validarEvidencia}=require("../../modules/finanzas-personales/services/actualizarAccionProgresoPersonal.service");
const movimiento={_id:"movimiento",estado:"ACTIVA",moneda:"COP",tipo:"GASTO",montoMinor:1800,fecha:new Date(Date.now()-60000),compensacionHash:"a".repeat(64)};
test("la evidencia conserva importe vigente y hash compensatorio",()=>{
 const r=validarEvidencia(movimiento,"GASTO",1800);
 assert.equal(r.montoMinor,1800);assert.equal(r.compensacionHash,movimiento.compensacionHash);
 assert.throws(()=>validarEvidencia(movimiento,"GASTO",2000),e=>e.statusCode===422);
});
test("no respaldan resultados los movimientos anulados, futuros, incompatibles o inseguros",()=>{
 for(const cambio of [{estado:"ANULADA"},{fecha:new Date(Date.now()+86400000)},{moneda:"USD"},
  {montoMinor:1.5},{tipo:"INGRESO"}]){
  assert.throws(()=>validarEvidencia({...movimiento,...cambio},"GASTO",100),e=>e.statusCode===422);
 }
});
test("un ingreso solo respalda un cobro si identifica su cuenta por cobrar",()=>{
 assert.throws(()=>validarEvidencia({...movimiento,tipo:"INGRESO"},"COBRO",100),e=>e.statusCode===422);
 assert.equal(validarEvidencia({...movimiento,tipo:"INGRESO",prestamoId:"prestamo"},"COBRO",100).tipo,"INGRESO");
});
