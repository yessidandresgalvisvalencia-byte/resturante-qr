"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {comprobarHistorialCompensatorio}=require("../../modules/finanzas-personales/services/comprobarHistorialCompensatorio.service");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const usuarioId="507f1f77bcf86cd799439011";
const original={usuarioId,movimientoId:"507f1f77bcf86cd799439012",tipo:"GASTO",
 montoMinor:25000,concepto:"Rappi",categoria:"Comida"};
const genesis="0".repeat(64),fechaISO="2026-10-20T15:00:00.000Z";
const crear=(original,tipo,cambios,idempotencyKey,secuencia,prevHash)=>
 eventoCompensatorio({original,tipo,cambios,idempotencyKey,secuencia,prevHash,fechaISO});
test("valida estado vigente entre correcciones del mismo movimiento",()=>{
 const a=crear(original,"CORRECCION",{montoMinor:22000},"a",1,genesis);
 const b=crear({...original,montoMinor:22000},"CORRECCION",{montoMinor:20000},"b",2,a.hashActual);
 const estados=comprobarHistorialCompensatorio([a,b],{usuarioId});
 assert.equal(estados.get(original.movimientoId).actual.montoMinor,20000);
});
test("bloquea secuencia con hashes válidos pero estado financiero contradictorio",()=>{
 const a=crear(original,"CORRECCION",{montoMinor:22000},"a",1,genesis);
 const b=crear(original,"CORRECCION",{montoMinor:20000},"b",2,a.hashActual);
 assert.throws(()=>comprobarHistorialCompensatorio([a,b],{usuarioId}),/INTEGRIDAD_LEDGER/);
});
test("rechaza correcciones posteriores a anulación aunque sus hashes sean válidos",()=>{
 const a=crear(original,"ANULACION",{},"a",1,genesis);
 const b=crear(original,"CORRECCION",{montoMinor:22000},"b",2,a.hashActual);
 assert.throws(()=>comprobarHistorialCompensatorio([a,b],{usuarioId}),/INTEGRIDAD_LEDGER/);
});
test("reconstruye movimientos intercalados y rechaza eventos de otro usuario",()=>{
 const otro={...original,movimientoId:"507f1f77bcf86cd799439013",tipo:"INGRESO",montoMinor:10000};
 const a=crear(original,"CORRECCION",{montoMinor:22000},"a",1,genesis);
 const b=crear(otro,"CORRECCION",{montoMinor:11000},"b",2,a.hashActual);
 assert.equal(comprobarHistorialCompensatorio([a,b],{usuarioId}).size,2);
 assert.throws(()=>comprobarHistorialCompensatorio([a,b],{usuarioId:"otro"}),/INTEGRIDAD_LEDGER/);
});
