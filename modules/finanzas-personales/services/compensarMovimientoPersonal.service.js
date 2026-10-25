"use strict";
const crypto=require("node:crypto");
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Cuenta=require("../models/cuentaFinanciera.model");
const Outbox=require("../models/outboxPersonal.model");
const Evento=require("../models/EventoCompensatorioPersonal");
const {crearRegistrador}=require("./registradorCompensacionPersonal.service");
const {vigente}=require("./estadoCompensadoPersonal.service");
const {filtroSaldoSeguro}=require("./limitesSaldoPersonal.service");
const registrar=crearRegistrador();
const error=(mensaje,statusCode=409)=>Object.assign(new Error(mensaje),{statusCode});
// Preparación de integración: NO conectado a rutas. Las consultas actuales todavía necesitan
// proyectar compensaciones antes de activar este flujo. No modificar la transacción original.
function crearAplicador({OutboxModelo=Outbox}={}){
 return async function compensar({usuarioId,movimientoId,tipo,cambios={},idempotencyKey}){
  if(!mongoose.isObjectIdOrHexString(usuarioId)||!mongoose.isObjectIdOrHexString(movimientoId))
   throw error("Usuario o movimiento inválido",400);
  if(typeof idempotencyKey!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(idempotencyKey))
   throw error("Idempotencia obligatoria",400);
  if(cambios?.concepto!==undefined&&(typeof cambios.concepto!=="string"||cambios.concepto.length>140)||
     cambios?.categoria!==undefined&&(typeof cambios.categoria!=="string"||cambios.categoria.length>80))
   throw error("Texto de corrección inválido",400);
  const session=await mongoose.startSession();
  try{
   let evento;
   await session.withTransaction(async()=>{
    const fuente=await Transaccion.findOne({_id:movimientoId,usuarioId}).session(session).lean();
    if(!fuente)throw error("Movimiento no disponible",404);
    if(fuente.estado!=="ACTIVA"||!["INGRESO","GASTO"].includes(fuente.tipo)||
       fuente.moneda!=="COP"||fuente.impactoCaja!==true||fuente.medioPago==="CREDITO"||
       fuente.recurrente||fuente.recurrenteOrigenId||fuente.prestamoId||!fuente.cuentaId)
     throw error("Movimiento requiere tratamiento especial; compensación de caja bloqueada");
    const original={usuarioId:String(fuente.usuarioId),movimientoId:String(fuente._id),
     tipo:fuente.tipo,montoMinor:fuente.montoMinor,concepto:fuente.concepto,categoria:fuente.categoria};
    const historial=await Evento.find({usuarioId:original.usuarioId,movimientoId:original.movimientoId},
     {_id:0}).sort({secuencia:1}).session(session).lean();
    const estado=vigente(original,historial);
    if(estado.anulado)throw error("Movimiento ya anulado");
    evento=await registrar({original:estado.actual,tipo,cambios,idempotencyKey,
     fechaISO:new Date().toISOString()},{session});
    const delta=Number(BigInt(evento.deltaCajaMinor));
    if(!Number.isSafeInteger(delta))throw error("Delta de caja fuera de rango");
    const cuenta=await Cuenta.findOneAndUpdate({_id:fuente.cuentaId,usuarioId,
     activa:true,moneda:"COP",...filtroSaldoSeguro(delta)},{$inc:{saldoMinor:delta}},
     {session,returnDocument:"after"});
    if(!cuenta)throw error("Cuenta no disponible o saldo insuficiente para compensar");
    await OutboxModelo.create([{usuarioId,eventId:crypto.randomUUID(),
     eventName:tipo==="ANULACION"?"MOVIMIENTO_ANULADO":"MOVIMIENTO_CORREGIDO",
     aggregateId:fuente._id,payload:{transaccionId:String(fuente._id),
      compensacionHash:evento.hashActual,secuencia:evento.secuencia,
      deltaCajaMinor:evento.deltaCajaMinor,antes:estado.actual,
      despues:tipo==="ANULACION"?null:{...estado.actual,...cambios}}}],{session});
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
   return evento;
  }finally{await session.endSession();}
 };
}
module.exports={crearAplicador};
