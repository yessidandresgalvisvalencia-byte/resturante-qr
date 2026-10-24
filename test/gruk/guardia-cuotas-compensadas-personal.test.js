"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {comprobarPagosSinCompensacionesPendientes}=require(
 "../../modules/finanzas-personales/services/guardiaCuotasCompensadasPersonal.service");
const {eventoCompensatorio}=require(
 "../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const uid="507f1f77bcf86cd799439011";
const origen={_id:"507f1f77bcf86cd799439012"};
const pago={_id:"507f1f77bcf86cd799439020",usuarioId:uid,
 recurrenteOrigenId:origen._id,tipo:"GASTO",estado:"ACTIVA",
 impactoCaja:true,montoMinor:200000,concepto:"Abono arriendo",
 categoria:"Vivienda"};
const genesis="0".repeat(64);
function evento(tipo,cambios){
 return eventoCompensatorio({original:{usuarioId:uid,
  movimientoId:pago._id,tipo:pago.tipo,montoMinor:pago.montoMinor,
  concepto:pago.concepto,categoria:pago.categoria},
  tipo,cambios,idempotencyKey:"unico_1",prevHash:genesis,
  secuencia:1,fechaISO:"2026-10-24T20:00:00.000Z"});
}
test("historial sin compensaciones validado contra génesis",()=>{
 assert.equal(comprobarPagosSinCompensacionesPendientes({
  usuarioId:uid,origen,pagos:[pago],eventos:[],
  cursor:{secuencia:0,hashActual:genesis}
 }),true);
});
test("corrección de monto y anulación no permiten usar reserva vieja",()=>{
 for(const [tipo,cambios] of [
  ["CORRECCION",{montoMinor:100000}],
  ["ANULACION",{}],
  ["CORRECCION",{concepto:"Abono corregido"}]
 ]){
  const e=evento(tipo,cambios);
  assert.throws(()=>comprobarPagosSinCompensacionesPendientes({
   usuarioId:uid,origen,pagos:[pago],eventos:[e],
   cursor:{secuencia:1,hashActual:e.hashActual}
  }),err=>err.statusCode===409&&/conciliar reserva/.test(err.message));
 }
});
test("rechaza cursor incongruente, cadena alterada y eventos huérfanos",()=>{
 const e=evento("CORRECCION",{montoMinor:100000});
 for(const cfg of [
  {eventos:[e],cursor:null},
  {eventos:[e],cursor:{secuencia:0,hashActual:e.hashActual}},
  {eventos:[{...e,hashActual:genesis}],
   cursor:{secuencia:1,hashActual:genesis}}
 ])assert.throws(()=>comprobarPagosSinCompensacionesPendientes({
  usuarioId:uid,origen,pagos:[pago],...cfg}),err=>err.statusCode===409);
});
test("ningún abono repetido o de otro usuario entra a conciliación",()=>{
 for(const pagos of [[pago,pago],[{...pago,usuarioId:"507f1f77bcf86cd799439099"}]])
  assert.throws(()=>comprobarPagosSinCompensacionesPendientes({
   usuarioId:uid,origen,pagos,eventos:[],cursor:null
  }),err=>err.statusCode===409);
});
