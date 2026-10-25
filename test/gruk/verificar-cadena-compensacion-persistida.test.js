"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {eventoCompensatorio,verificarCadena}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",movimientoId="507f1f77bcf86cd799439012";
const original={usuarioId,movimientoId,tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
const genesis="0".repeat(64),fechaISO="2026-10-20T15:00:00.000Z";
function crear(o,tipo,cambios,idempotencyKey,secuencia,prevHash){
 return eventoCompensatorio({original:o,tipo,cambios,idempotencyKey,secuencia,prevHash,fechaISO});
}
test("verificador acepta cadena original y documentos de Mongo con _id",()=>{
 const a=crear(original,"CORRECCION",{montoMinor:22000},"corr1",1,genesis);
 const b=crear({...original,montoMinor:22000},"ANULACION",{},"anula1",2,a.hashActual);
 assert.equal(verificarCadena([a,b],{prevHash:genesis}),true);
 assert.equal(verificarCadena([{...a,_id:"507f1f77bcf86cd799439015"},{...b,_id:"507f1f77bcf86cd799439016"}],{prevHash:genesis}),true);
});
test("verificador rechaza campo extra, cambios firmados, reordenamientos y huecos",()=>{
 const a=crear(original,"CORRECCION",{montoMinor:22000},"corr1",1,genesis);
 const b=crear({...original,montoMinor:22000},"ANULACION",{},"anula1",2,a.hashActual);
 for(const eventos of [
  [{...a,admin:true},b],
  [{...a,deltaCajaMinor:"999"},b],
  [b,a],
  [b],
  [a,{...b,secuencia:3}],
  [a,{...b,idempotencyKey:"corr1"}]
 ])assert.equal(verificarCadena(eventos,{prevHash:genesis}),false);
});
test("verificador falla cerrado si el payload contiene un valor no canónico",()=>{
 const a=crear(original,"CORRECCION",{montoMinor:22000},"corr1",1,genesis);
 assert.equal(verificarCadena([{...a,cambios:{montoMinor:Infinity}}],{prevHash:genesis}),false);
 assert.equal(verificarCadena([{...a,original:{...original,montoMinor:NaN}}],{prevHash:genesis}),false);
});
