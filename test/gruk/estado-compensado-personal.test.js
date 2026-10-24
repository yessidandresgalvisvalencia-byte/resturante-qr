"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const {vigente}=require("../../modules/finanzas-personales/services/estadoCompensadoPersonal.service");
const original={usuarioId:"507f1f77bcf86cd799439011",movimientoId:"507f1f77bcf86cd799439012",tipo:"GASTO",
 montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
const zero="0".repeat(64);
const h="2026-10-20T15:00:00.000Z";
const crear=(orig,tipo,cambios,idempotencyKey,secuencia,prevHash)=>eventoCompensatorio({
 original:orig,tipo,cambios,idempotencyKey,secuencia,prevHash,fechaISO:h
});
test("segunda corrección se calcula desde el importe vigente, no desde el original",()=>{
 const uno=crear(original,"CORRECCION",{montoMinor:22000},"corregir_1",1,zero);
 const vigenteUno=vigente(original,[uno]);
 assert.equal(vigenteUno.actual.montoMinor,22000);
 assert.equal(vigenteUno.anulado,false);
 const dos=crear(vigenteUno.actual,"CORRECCION",{montoMinor:20000},"corregir_2",2,uno.hashActual);
 assert.equal(dos.deltaCajaMinor,"2000");
 const final=vigente(original,[uno,dos]);
 assert.equal(final.actual.montoMinor,20000);
 assert.equal(final.ultimaSecuencia,2);
 assert.equal(original.montoMinor,25000);
});
test("anular después de corregir revierte el importe efectivo vigente",()=>{
 const uno=crear(original,"CORRECCION",{montoMinor:22000},"corregir_1",1,zero);
 const dos=crear({...original,montoMinor:22000},"ANULACION",{},"anular_1",2,uno.hashActual);
 assert.equal(dos.deltaCajaMinor,"22000");
 const final=vigente(original,[uno,dos]);
 assert.equal(final.anulado,true);
 assert.equal(final.actual.montoMinor,22000);
});
test("una segunda anulación o corrección posterior a anulación es inválida",()=>{
 const anulada=crear(original,"ANULACION",{},"anular_1",1,zero);
 const repetir=crear(original,"ANULACION",{},"anular_2",2,anulada.hashActual);
 const correccion=crear(original,"CORRECCION",{montoMinor:20000},"corregir_2",2,anulada.hashActual);
 assert.throws(()=>vigente(original,[anulada,repetir]),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>vigente(original,[anulada,correccion]),/INTEGRIDAD_LEDGER/);
});
test("proyección verifica contenido, identidad, orden y delta original",()=>{
 const uno=crear(original,"CORRECCION",{montoMinor:22000},"corregir_1",1,zero);
 const modificado={...uno,deltaCajaMinor:"50000"};
 const ajeno={...uno,usuarioId:"otro"};
 const omitido={...uno,secuencia:2};
 const falsoOriginal={...uno,original:{...original,montoMinor:999}};
 for(const e of [modificado,ajeno,omitido,falsoOriginal])
  assert.throws(()=>vigente(original,[e]),/INTEGRIDAD_LEDGER/);
});
test("el estado sin eventos conserva copia independiente del original",()=>{
 const r=vigente(original,[]);
 assert.deepEqual(r.actual,original);
 assert.notEqual(r.actual,original);
 assert.equal(r.anulado,false);
});

test("proyección acepta documento Mongo con _id sin incluirlo en la firma",()=>{
 const e=crear(original,"CORRECCION",{montoMinor:22000},"mongo_1",1,zero);
 const r=vigente(original,[{...e,_id:"507f1f77bcf86cd799439099"}]);
 assert.equal(r.actual.montoMinor,22000);
});
test("proyección rechaza campos ocultos, claves duplicadas y originales extraños",()=>{
 const a=crear(original,"CORRECCION",{montoMinor:22000},"duplicada",1,zero);
 const siguiente={...original,montoMinor:22000};
 const b=crear(siguiente,"CORRECCION",{montoMinor:20000},"duplicada",2,a.hashActual);
 assert.throws(()=>vigente(original,[a,b]),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>vigente(original,[{...a,administrador:true}]),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>vigente({...original,campoInesperado:1},[]),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>vigente({...original,montoMinor:0},[]),/INTEGRIDAD_LEDGER/);
});
