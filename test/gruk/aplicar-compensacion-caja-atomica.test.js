"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearAplicadorAtomicoPersonal}=require("../../modules/finanzas-personales/services/aplicarCompensacionCajaAtomica.service");
const usuarioId="507f1f77bcf86cd799439011",movimientoId="507f1f77bcf86cd799439012";
const asiento={_id:movimientoId,usuarioId,tipo:"GASTO",montoMinor:25000,
 cuentaId:"507f1f77bcf86cd799439013",estado:"ACTIVA",impactoCaja:true,recurrente:false};
const evento={usuarioId,movimientoId,tipo:"CORRECCION",deltaCajaMinor:"3000",
 hashActual:"a".repeat(64),secuencia:1};
function simular({saldo=10000,cuentaValida=true,outboxFalla=false}={}){
 const recibido={};
 const CuentaModelo={async findOneAndUpdate(filtro,update,opciones){
  recibido.filtro=filtro;recibido.update=update;recibido.opciones=opciones;
  if(!cuentaValida||saldo+update.$inc.saldoMinor<0)return null;
  return {_id:asiento.cuentaId,saldoMinor:saldo+update.$inc.saldoMinor};
 }};
 const OutboxModelo={async create(rows,opciones){
  if(outboxFalla)throw Error("Outbox no disponible");
  recibido.outbox=rows[0];recibido.outboxOptions=opciones;
  return [{_id:"507f1f77bcf86cd799439014"}];
 }};
 return {recibido,aplicar:crearAplicadorAtomicoPersonal({
  CuentaModelo,OutboxModelo,nuevoEventId:()=>"uuid-simulado"
 })};
}
test("aplica delta y publica outbox usando exactamente la misma sesión",async()=>{
 const {aplicar,recibido}=simular();
 const session={token:"snapshot"};
 const resultado=await aplicar({session,evento,asiento});
 assert.equal(resultado.cuenta.saldoMinor,13000);
 assert.equal(recibido.opciones.session,session);
 assert.equal(recibido.outboxOptions.session,session);
 assert.equal(recibido.filtro.usuarioId,usuarioId);
 assert.equal(recibido.filtro.requiereReconciliacion,false);
 assert.equal(recibido.outbox.payload.compensacionHash,evento.hashActual);
 assert.equal(recibido.outbox.eventName,"MOVIMIENTO_CORREGIDO");
});
test("anulación se identifica como evento financiero de reverso",async()=>{
 const {aplicar,recibido}=simular();
 await aplicar({session:{},asiento,evento:{...evento,tipo:"ANULACION",deltaCajaMinor:"25000"}});
 assert.equal(recibido.outbox.eventName,"MOVIMIENTO_ANULADO");
});
test("rechaza cuentas no conciliadas, faltantes y fondos insuficientes",async()=>{
 for(const opciones of [{cuentaValida:false},{saldo:100}]){
  const {aplicar}=simular(opciones);
  await assert.rejects(aplicar({session:{},asiento,evento:{...evento,deltaCajaMinor:"-200"}}),
   /CAJA_COMPENSACION_NO_APLICABLE/);
 }
});
test("rechaza recurrentes, préstamos, identidad cruzada o falta de impacto",async()=>{
 for(const cambio of [
  {recurrente:true},{recurrenteOrigenId:"id"},{prestamoId:"id"},
  {usuarioId:"ajeno"},{impactoCaja:false},{cuentaId:null},{estado:"ANULADA"}
 ]){
  const {aplicar,recibido}=simular();
  await assert.rejects(aplicar({session:{},asiento:{...asiento,...cambio},evento}),
   /CAJA_COMPENSACION_NO_APLICABLE/);
  assert.equal(recibido.update,undefined);
 }
});
test("bloquea overflow, decimales, números inseguros y outbox fallido",async()=>{
 for(const deltaCajaMinor of ["0.1","9007199254740992","1e8"]){
  const {aplicar,recibido}=simular();
  await assert.rejects(aplicar({session:{},asiento,evento:{...evento,deltaCajaMinor}}),
   /CAJA_COMPENSACION_NO_APLICABLE/);
  assert.equal(recibido.update,undefined);
 }
 const {aplicar}=simular({outboxFalla:true});
 await assert.rejects(aplicar({session:{},asiento,evento}),/Outbox no disponible/);
});
