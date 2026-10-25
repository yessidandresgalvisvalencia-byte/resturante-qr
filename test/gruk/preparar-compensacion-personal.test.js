"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {prepararCompensacion}=require("../../modules/finanzas-personales/services/prepararCompensacionPersonal.service");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",movimientoId="507f1f77bcf86cd799439012";
const original={usuarioId,movimientoId,tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
const genesis="0".repeat(64),fechaISO="2026-10-20T15:00:00.000Z";
const cero={_id:usuarioId,secuencia:0,hashActual:genesis};
const propuesta=(eventos=[],cursor=cero,otro={})=>prepararCompensacion({
 usuarioId,originales:[original],eventos,cursor,movimientoId,tipo:"CORRECCION",
 cambios:{montoMinor:22000},idempotencyKey:"corr_1",fechaISO,...otro
});
test("preflight calcula delta BigInt exacto sin mutar el original",()=>{
 const r=propuesta();
 assert.equal(r.evento.deltaCajaMinor,"3000");
 assert.equal(r.evento.secuencia,1);
 assert.equal(r.evento.prevHash,genesis);
 assert.equal(r.esperado.hashActual,genesis);
 assert.equal(original.montoMinor,25000);
});
test("preflight rechaza misma clave de idempotencia incluso si el contenido cambia",()=>{
 const uno=propuesta().evento;
 const cursor={_id:usuarioId,secuencia:1,hashActual:uno.hashActual};
 assert.throws(()=>propuesta([uno],cursor),/INTEGRIDAD_LEDGER/);
});
test("preflight calcula segundo delta sobre estado vigente, no sobre el inicial",()=>{
 const uno=propuesta().evento;
 const cursor={_id:usuarioId,secuencia:1,hashActual:uno.hashActual};
 const dos=propuesta([uno],cursor,{idempotencyKey:"corr_2",cambios:{montoMinor:20000}});
 assert.equal(dos.evento.deltaCajaMinor,"2000");
 assert.equal(dos.evento.original.montoMinor,22000);
});
test("preflight prohíbe anular dos veces o corregir un asiento anulado",()=>{
 const e=eventoCompensatorio({original,tipo:"ANULACION",cambios:{},idempotencyKey:"anula_1",prevHash:genesis,secuencia:1,fechaISO});
 const cursor={_id:usuarioId,secuencia:1,hashActual:e.hashActual};
 assert.throws(()=>propuesta([e],cursor,{tipo:"ANULACION",cambios:{},idempotencyKey:"anula_2"}),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>propuesta([e],cursor,{idempotencyKey:"corr_2"}),/INTEGRIDAD_LEDGER/);
});
test("preflight rechaza cursor obsoleto, identidad ajena y movimiento inexistente",()=>{
 const e=propuesta().evento;
 assert.throws(()=>propuesta([e],cero,{idempotencyKey:"corr_2"}),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>propuesta([] ,cero,{movimientoId:"otro"}),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>propuesta([] ,cero,{usuarioId:"otro"}),/INTEGRIDAD_LEDGER/);
});
test("preflight no permite montos inseguros, negativos ni correcciones sin efecto",()=>{
 for(const montoMinor of [0,-1,0.1,Number.MAX_SAFE_INTEGER+1])
  assert.throws(()=>propuesta([],cero,{cambios:{montoMinor},idempotencyKey:"nuevo"}),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>propuesta([],cero,{cambios:{montoMinor:25000}}),/INTEGRIDAD_LEDGER/);
});
