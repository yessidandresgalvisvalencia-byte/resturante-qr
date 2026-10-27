"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto");
const Prestamo=require("../models/prestamoPersonal.model"),Tx=require("../models/TransaccionPersonal");
const Cuenta=require("../models/cuentaFinanciera.model"),Outbox=require("../models/outboxPersonal.model");
const Evento=require("../models/EventoCompensatorioPersonal");
const {consultarPeriodo}=require("./consultaCompensadaPersonal.service");
const {originalDesdeFuente}=require("./eventoCompensatorioPersonal.service");
const {vigente}=require("./estadoCompensadoPersonal.service");
const {crearRegistrador}=require("./registradorCompensacionPersonal.service");
const {serializarEscrituraFuente}=require("./proteccionOriginalCompensadoPersonal.service");
const {filtroSaldoSeguro}=require("./limitesSaldoPersonal.service");
const registrar=crearRegistrador(),problema=(m,statusCode=409)=>Object.assign(new Error(m),{statusCode});
const config={readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"};
async function pagosCreditoVigentes(usuarioId,prestamoId,{session}={}){
 return (await consultarPeriodo({usuarioId,desde:"0001-01-01T00:00:00.000Z",hasta:"9999-12-31T23:59:59.999Z"},{session}))
  .filter(x=>String(x.prestamoId)===String(prestamoId)&&x.tipo==="PAGO_DEUDA");
}
function validarPagosCredito(p,pagos){
 if(!p||p.direccion!=="POR_PAGAR"||!Number.isSafeInteger(p.principalMinor)||p.principalMinor<1||
  !Number.isSafeInteger(p.saldoMinor)||p.saldoMinor<0||p.saldoMinor>p.principalMinor)
  throw problema("Saldo del crédito no conciliable");
 const ordenados=pagos.map(tx=>{
  let original;
  try{original=originalDesdeFuente(tx);}catch{throw problema("Capital y pago real no conciliables");}
  if(String(tx.usuarioId)!==String(p.usuarioId)||String(tx.prestamoId)!==String(p._id)||tx.estado!=="ACTIVA"||
   tx.moneda!=="COP"||tx.recurrente||tx.recurrenteOrigenId||tx.medioPago==="CREDITO"||
   tx.impactoCaja&&!tx.cuentaId||!tx.impactoCaja&&tx.cuentaId||
   !(tx.fecha instanceof Date)||!Number.isFinite(+tx.fecha)||+tx.fecha>Date.now())throw problema("Pago de crédito no conciliable");
  return {tx,original};
 }).sort((a,b)=>a.original.numeroCuota-b.original.numeroCuota);
 let capital=0n,real=0n;
 for(const [i,pago] of ordenados.entries()){
  if(pago.original.numeroCuota!==i+1)throw problema("La secuencia de cuotas necesita revisión");
  capital+=BigInt(pago.original.montoMinor);real+=BigInt(pago.original.montoPagadoRealMinor);
 }
 // Puede existir capital pagado antes de comenzar este historial. Nunca inventarlo como cuota.
 if(capital>BigInt(p.principalMinor)-BigInt(p.saldoMinor))throw problema("Los pagos exceden el capital abonado");
 if(real>BigInt(Number.MAX_SAFE_INTEGER))throw problema("Total pagado fuera de rango seguro",422);
 return {pagos:ordenados.map(x=>x.tx),totalPagadoRealMinor:Number(real)};
}
async function obtenerPagosCredito(usuarioId,prestamoId){
 const session=await mongoose.startSession();
 try{return await session.withTransaction(async()=>{
  const prestamo=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_PAGAR"}).session(session).lean();
  if(!prestamo)throw problema("Deuda no encontrada",404);
  return {prestamo,...validarPagosCredito(prestamo,await pagosCreditoVigentes(usuarioId,prestamoId,{session}))};
 },{readConcern:{level:"snapshot"},readPreference:"primary"});}
 finally{await session.endSession();}
}
async function deshacer(usuarioId,prestamoId,{movimientoId,idempotencyKey}={}){
 if(![usuarioId,prestamoId,movimientoId].every(x=>mongoose.isObjectIdOrHexString(x))||
  typeof idempotencyKey!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(idempotencyKey))
  throw problema("Préstamo, pago y clave idempotente obligatorios",400);
 const session=await mongoose.startSession();
 try{return await session.withTransaction(async()=>{
  await serializarEscrituraFuente(usuarioId,session);
  const fuente=await Tx.findOne({_id:movimientoId,usuarioId,prestamoId,tipo:"PAGO_DEUDA",estado:"ACTIVA"}).session(session).lean();
  if(!fuente)throw problema("Pago de crédito no encontrado",404);
  let original;
  try{original=originalDesdeFuente(fuente);}catch{throw problema("Capital y pago real no conciliables");}
  const historial=await Evento.find({usuarioId:String(usuarioId),movimientoId:String(movimientoId)},{_id:0}).sort({secuencia:1}).session(session).lean();
  const estado=vigente(original,historial);
  const repetido=await Evento.findOne({usuarioId:String(usuarioId),idempotencyKey},{_id:0}).session(session).lean();
  if(repetido){
   if(repetido.movimientoId!==String(movimientoId)||repetido.tipo!=="ANULACION"||!estado.anulado||
    !historial.some(e=>e.hashActual===repetido.hashActual))throw problema("Clave idempotente utilizada para otra operación");
   return {duplicado:true,numeroCuota:original.numeroCuota,transaccionAnuladaId:String(movimientoId),compensacion:repetido};
  }
  if(estado.anulado)throw problema("Pago de crédito ya revertido");
  const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO","PAGADO"]}}).session(session);
  if(!p)throw problema("Deuda no encontrada",404);
  const {pagos}=validarPagosCredito(p,await pagosCreditoVigentes(usuarioId,prestamoId,{session}));
  if(!pagos.length||String(pagos.at(-1)._id)!==String(movimientoId))throw problema("Solo se puede deshacer el último pago vigente");
  const saldo=BigInt(p.saldoMinor)+BigInt(original.montoMinor);
  if(saldo>BigInt(p.principalMinor)||!Number.isSafeInteger(p.cuotaMinor)||p.cuotaMinor<1)throw problema("Reversión no conciliable con la deuda");
  const compensacion=await registrar({original,tipo:"ANULACION",idempotencyKey,fechaISO:new Date().toISOString()},{session});
  if(original.impactoCaja){
   const delta=Number(BigInt(compensacion.deltaCajaMinor));
   const cuenta=await Cuenta.findOneAndUpdate({_id:fuente.cuentaId,usuarioId,activa:true,moneda:"COP",...filtroSaldoSeguro(delta)},{$inc:{saldoMinor:delta}},{session,returnDocument:"after"});
   if(!cuenta||!Number.isSafeInteger(cuenta.saldoMinor))throw problema("No se pudo restaurar la cuenta de origen");
  }
  p.saldoMinor=Number(saldo);p.estado=p.fechaVencimiento&&p.fechaVencimiento<new Date()?"VENCIDO":"ACTIVO";
  p.periodicidadConfirmada=true;await p.save({session});
  await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_PATRIMONIAL",aggregateId:fuente._id,
   payload:{accion:"ANULACION_PAGO_DEUDA",prestamoId:String(prestamoId),transaccionId:String(movimientoId),numeroCuota:original.numeroCuota,
    montoMinor:original.montoMinor,montoPagadoRealMinor:original.montoPagadoRealMinor,compensacionHash:compensacion.hashActual,
    secuencia:compensacion.secuencia,deltaCajaMinor:compensacion.deltaCajaMinor,saldoPendienteMinor:p.saldoMinor}}],{session});
  return {duplicado:false,numeroCuota:original.numeroCuota,saldoPendienteMinor:p.saldoMinor,transaccionAnuladaId:String(movimientoId),compensacion};
 },config);}catch(e){if(e.code===11000)throw problema("Operación concurrente; consulta el pago antes de reintentar");throw e;}
 finally{await session.endSession();}
}
module.exports={pagosCreditoVigentes,validarPagosCredito,obtenerPagosCredito,deshacer};
