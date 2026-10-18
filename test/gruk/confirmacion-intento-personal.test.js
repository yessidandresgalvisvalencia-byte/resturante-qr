"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {coincideIntento,confirmarIntento}=
 require("../../modules/finanzas-personales/services/confirmacionIntentoPersonal.service");
const base={_id:"507f1f77bcf86cd799439011",tipo:"GASTO",montoMinor:25000,moneda:"COP",concepto:"Rappi",
 categoria:"ALIMENTACION",subcategoria:"",cuenta:"EFECTIVO",medioPago:"EFECTIVO",
 contraparte:"",descripcion:"",recurrente:false,frecuencia:"NINGUNA",
 origen:"MANUAL",fecha:new Date("2026-10-18T00:00:00.000Z"),
 recurrenteOrigenId:null,prestamoId:null,estado:"ACTIVA"};
function repositorio(encontrado){
 return {findOne:query=>{
  assert.equal(query.usuarioId,"usuario-a");
  assert.equal(query.externalIdHash,"hash-a");
  return {lean:async()=>encontrado};
 }};
}
test("la misma transacción se confirma sin crear un segundo débito",async()=>{
 const resultado=await confirmarIntento({
  Transaccion:repositorio(base),usuarioId:"usuario-a",
  externalIdHash:"hash-a",esperado:{...base,fecha:"2026-10-18"}
 });
 assert.equal(resultado.confirmado,true);
 assert.equal(resultado.estado,"ACTIVA");
 assert.equal(resultado.transaccionId,base._id);
});
test("sin movimiento, no confirma y no inventa un saldo",async()=>{
 const resultado=await confirmarIntento({
  Transaccion:repositorio(null),usuarioId:"usuario-a",externalIdHash:"hash-a",esperado:base
 });
 assert.equal(resultado.confirmado,false);
 assert.equal(resultado.transaccionId,undefined);
});
test("la misma clave con monto, fecha, concepto o cuenta distintos nunca confirma",async()=>{
 for(const cambiado of [{montoMinor:25001},{fecha:"2026-10-19"},
  {concepto:"Otro gasto"},{cuenta:"BANCO"},{tipo:"INGRESO"}]){
  assert.equal(coincideIntento(base,{...base,...cambiado}),false);
  await assert.rejects(confirmarIntento({
   Transaccion:repositorio(base),usuarioId:"usuario-a",
   externalIdHash:"hash-a",esperado:{...base,...cambiado}
  }),e=>e.statusCode===409);
 }
});
test("movimiento anulado no aparece como pago activo confirmado",async()=>{
 const r=await confirmarIntento({
  Transaccion:repositorio({...base,estado:"ANULADA"}),
  usuarioId:"usuario-a",externalIdHash:"hash-a",esperado:base
 });
 assert.equal(r.confirmado,false);
 assert.equal(r.estado,"ANULADA");
 assert.equal(r.transaccionId,undefined);
});
test("la confirmación requiere identificador de operación",async()=>{
 await assert.rejects(confirmarIntento({
  Transaccion:repositorio(base),usuarioId:"usuario-a",externalIdHash:null,esperado:base
 }),e=>e.statusCode===400);
});

test("estado desconocido nunca confirma un pago ni revela su identificador",async()=>{
 for(const estado of ["PENDIENTE","ERROR",null,undefined]){
  await assert.rejects(
   confirmarIntento({
    Transaccion:repositorio({...base,estado}),
    usuarioId:"usuario-a",externalIdHash:"hash-a",esperado:base
   }),
   e=>e.statusCode===409 && /Estado de transacción no verificable/.test(e.message)
  );
 }
});
test("un origen recurrente o préstamo distinto no puede confirmar con igual clave",async()=>{
 for(const cambiado of [
  {recurrenteOrigenId:"507f1f77bcf86cd799439012"},
  {prestamoId:"507f1f77bcf86cd799439013"}
 ]){
  await assert.rejects(
   confirmarIntento({
    Transaccion:repositorio(base),
    usuarioId:"usuario-a",externalIdHash:"hash-a",
    esperado:{...base,...cambiado}
   }),
   e=>e.statusCode===409
  );
 }
});
