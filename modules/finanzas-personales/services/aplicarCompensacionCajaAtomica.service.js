"use strict";
const crypto=require("node:crypto");
const Cuenta=require("../models/cuentaFinanciera.model");
const Outbox=require("../models/outboxPersonal.model");
const {filtroSaldoSeguro}=require("./limitesSaldoPersonal.service");
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
function fallo(mensaje){throw Object.assign(new Error("CAJA_COMPENSACION_NO_APLICABLE: "+mensaje),{statusCode:409});}
// Adaptador ACID opt-in. Exclusivamente INGRESO/GASTO ordinarios; no se
// debe aplicar a préstamos, abonos, recurrentes ni saldos no verificados.
function crearAplicadorAtomicoPersonal({CuentaModelo=Cuenta,OutboxModelo=Outbox,
 nuevoEventId=()=>crypto.randomUUID()}={}){
 return async function aplicarAtomico({session,evento,asiento}){
  if(!session||!evento||!asiento||
     String(asiento.usuarioId)!==evento.usuarioId||
     String(asiento._id)!==evento.movimientoId||
     !["INGRESO","GASTO"].includes(asiento.tipo)||
     asiento.recurrente===true||asiento.recurrenteOrigenId||
     asiento.prestamoId||asiento.impactoCaja!==true||
     asiento.estado!=="ACTIVA"||!asiento.cuentaId)
   fallo("movimiento no elegible o identidad inconsistente");
  if(!/^-?(0|[1-9][0-9]*)$/.test(evento.deltaCajaMinor))
   fallo("delta monetario inválido");
  const deltaBig=BigInt(evento.deltaCajaMinor);
  if(deltaBig>MAX||deltaBig< -MAX)fallo("delta fuera de rango seguro");
  const delta=Number(deltaBig);
  const cuenta=await CuentaModelo.findOneAndUpdate({
   _id:asiento.cuentaId,usuarioId:asiento.usuarioId,activa:true,moneda:"COP",
   requiereReconciliacion:false,...filtroSaldoSeguro(delta)
  },{$inc:{saldoMinor:delta}},{session,returnDocument:"after"});
  if(!cuenta)fallo("cuenta no conciliada, inexistente o saldo insuficiente");
  const [outbox]=await OutboxModelo.create([{
   usuarioId:asiento.usuarioId,eventId:nuevoEventId(),
   eventName:evento.tipo==="ANULACION"?"MOVIMIENTO_ANULADO":"MOVIMIENTO_CORREGIDO",
   aggregateId:asiento._id,
   payload:{
    transaccionId:String(asiento._id),
    compensacionSecuencia:evento.secuencia,
    compensacionHash:evento.hashActual,
    deltaCajaMinor:evento.deltaCajaMinor
   }
  }],{session});
  if(!outbox||!outbox._id)throw new Error("Outbox financiero sin inserción confirmada");
  return {cuenta,outbox};
 };
}
module.exports={crearAplicadorAtomicoPersonal};
