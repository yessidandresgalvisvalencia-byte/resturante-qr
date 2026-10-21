"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const {auditarCompensaciones}=require("../../modules/finanzas-personales/services/auditarCompensacionesPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",movimientoId="507f1f77bcf86cd799439012";
const original={usuarioId,movimientoId,tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
const genesis="0".repeat(64),fechaISO="2026-10-20T15:00:00.000Z";
function evento(o,tipo,cambios,idempotencyKey,secuencia,prevHash){
 return eventoCompensatorio({original:o,tipo,cambios,idempotencyKey,secuencia,prevHash,fechaISO});
}
function auditar(eventos,cursor,originales=[original],id=usuarioId){
 return auditarCompensaciones({usuarioId:id,originales,eventos,cursor});
}
test("auditor acepta genesis vacío y cursor exacto",()=>{
 const r=auditar([],{_id:usuarioId,secuencia:0,hashActual:genesis});
 assert.equal(r.estados[0].actual.montoMinor,25000);
 assert.equal(r.secuencia,0);
});
test("auditor recompone dos correcciones y anulación sin modificar asiento original",()=>{
 const uno=evento(original,"CORRECCION",{montoMinor:22000},"corr_1",1,genesis);
 const dos=evento({...original,montoMinor:22000},"CORRECCION",{montoMinor:20000},"corr_2",2,uno.hashActual);
 const tres=evento({...original,montoMinor:20000},"ANULACION",{},"anular_1",3,dos.hashActual);
 const r=auditar([uno,dos,tres],{_id:usuarioId,secuencia:3,hashActual:tres.hashActual});
 assert.equal(r.estados[0].actual.montoMinor,20000);
 assert.equal(r.estados[0].anulado,true);
 assert.equal(original.montoMinor,25000);
});
test("auditor rechaza salto de secuencia, hash previo falso y cursor obsoleto",()=>{
 const uno=evento(original,"CORRECCION",{montoMinor:22000},"corr_1",1,genesis);
 const dos=evento({...original,montoMinor:22000},"ANULACION",{},"anular_1",2,uno.hashActual);
 const cursor={_id:usuarioId,secuencia:2,hashActual:dos.hashActual};
 assert.throws(()=>auditar([dos],cursor),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>auditar([{...uno,prevHash:"f".repeat(64)},dos],cursor),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>auditar([uno,dos],{...cursor,secuencia:1}),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>auditar([uno,dos],{...cursor,hashActual:genesis}),/INTEGRIDAD_LEDGER/);
});
test("auditor rechaza sustitución de movimiento, monto o identidad",()=>{
 const uno=evento(original,"CORRECCION",{montoMinor:22000},"corr_1",1,genesis);
 const cursor={_id:usuarioId,secuencia:1,hashActual:uno.hashActual};
 for(const e of [{...uno,deltaCajaMinor:"999"},{...uno,movimientoId:"otro"},
  {...uno,usuarioId:"otro"},{...uno,original:{...original,montoMinor:100}}])
  assert.throws(()=>auditar([e],cursor),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>auditar([uno],cursor,[{...original,usuarioId:"otro"}]),/INTEGRIDAD_LEDGER/);
});
test("auditor rechaza compensación posterior a anulación y claves duplicadas",()=>{
 const uno=evento(original,"ANULACION",{},"repetida",1,genesis);
 const dos=evento(original,"CORRECCION",{montoMinor:22000},"repetida",2,uno.hashActual);
 assert.throws(()=>auditar([uno,dos],{_id:usuarioId,secuencia:2,hashActual:dos.hashActual}),/INTEGRIDAD_LEDGER/);
});
test("auditor rechaza modificaciones extra y movimientos originales repetidos",()=>{
 const uno=evento(original,"CORRECCION",{montoMinor:22000},"corr_1",1,genesis);
 const cursor={_id:usuarioId,secuencia:1,hashActual:uno.hashActual};
 assert.throws(()=>auditar([{...uno,admin:true}],cursor),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>auditar([],{_id:usuarioId,secuencia:0,hashActual:genesis},[original,original]),/INTEGRIDAD_LEDGER/);
});

test("auditor acepta _id persistido en Mongo sin firmar metadatos del almacenamiento",()=>{
 const uno=evento(original,"CORRECCION",{montoMinor:22000},"corr_mongo_1",1,genesis);
 const cursor={_id:usuarioId,secuencia:1,hashActual:uno.hashActual};
 const persistido={...uno,_id:"507f1f77bcf86cd799439099"};
 assert.equal(auditar([persistido],cursor).estados[0].actual.montoMinor,22000);
 assert.throws(()=>auditar([{...persistido,__v:1}],cursor),/INTEGRIDAD_LEDGER/);
});
test("auditor comprueba una sola cadena por usuario aunque se alternen movimientos",()=>{
 const segundo={...original,movimientoId:"507f1f77bcf86cd799439013",tipo:"INGRESO",montoMinor:90000,concepto:"Nomina"};
 const uno=evento(original,"CORRECCION",{montoMinor:22000},"corr_gasto",1,genesis);
 const dos=evento(segundo,"CORRECCION",{montoMinor:95000},"corr_ingreso",2,uno.hashActual);
 const cursor={_id:usuarioId,secuencia:2,hashActual:dos.hashActual};
 const result=auditar([uno,dos],cursor,[original,segundo]);
 assert.equal(result.estados.find(e=>e.movimientoId===original.movimientoId).actual.montoMinor,22000);
 assert.equal(result.estados.find(e=>e.movimientoId===segundo.movimientoId).actual.montoMinor,95000);
 assert.throws(()=>auditar([dos,uno],cursor,[original,segundo]),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>auditar([uno,dos],cursor,[original]),/INTEGRIDAD_LEDGER/);
});
