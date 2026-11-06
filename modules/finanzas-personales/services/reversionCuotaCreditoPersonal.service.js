"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto");
const Prestamo=require("../models/prestamoPersonal.model"),Tx=require("../models/TransaccionPersonal");
const Cuenta=require("../models/cuentaFinanciera.model"),Outbox=require("../models/outboxPersonal.model");
const {consultarPeriodo}=require("./consultaCompensadaPersonal.service");
const {originalDesdeFuente}=require("./eventoCompensatorioPersonal.service");
const {vigente}=require("./estadoCompensadoPersonal.service");
const {crearRegistrador,leerCadenaVerificada}=require("./registradorCompensacionPersonal.service");
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
  if(fuente.cicloCuota!==undefined&&!require("./cicloPagoPrestamoPersonal.service").verificar(fuente))throw problema("El ciclo original del pago no es verificable");
  let original;
  try{original=originalDesdeFuente(fuente);}catch{throw problema("Capital y pago real no conciliables");}
  const {cadena}=await leerCadenaVerificada(String(usuarioId),{session});
  const historial=cadena.filter(e=>e.movimientoId===String(movimientoId));
  const estado=vigente(original,historial);
  const repetido=cadena.find(e=>e.idempotencyKey===idempotencyKey);
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
async function restaurar(usuarioId,prestamoId,{movimientoId,idempotencyKey,anulacionHash,imputacion}={},{cerrarRechazo=false}={}){
 if(![usuarioId,prestamoId,movimientoId].every(x=>mongoose.isObjectIdOrHexString(x))||
  typeof idempotencyKey!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(idempotencyKey)||
  typeof anulacionHash!=="string"||!/^[a-f0-9]{64}$/.test(anulacionHash))throw problema("Préstamo, pago y anulación exacta obligatorios",400);
 if(imputacion!==undefined)await require("./imputacionPagoPersonal.service").exigirIndices();
 const session=await mongoose.startSession();
 try{return await session.withTransaction(async()=>{
  const fuente=await Tx.findOne({_id:movimientoId,usuarioId,prestamoId,tipo:"PAGO_DEUDA",estado:"ACTIVA"}).session(session).lean();
  if(!fuente)throw problema("Pago de préstamo no encontrado",404);
  let original;
  try{original=originalDesdeFuente(fuente);}catch{throw problema("Capital y pago real no conciliables");}
  const {cadena}=await leerCadenaVerificada(String(usuarioId),{session});
  const historial=cadena.filter(e=>e.movimientoId===String(movimientoId)),estado=vigente(original,historial);
  const repetido=cadena.find(e=>e.idempotencyKey===idempotencyKey);
  if(repetido){
   if(repetido.movimientoId!==String(movimientoId)||repetido.tipo!=="RESTAURACION"||repetido.anulacionHash!==anulacionHash)
    throw problema("Clave idempotente utilizada para otra operación");
   const e=await require("./restauracionCicloPagoPersonal.service").verificarReplay(usuarioId,prestamoId,fuente,idempotencyKey,anulacionHash,repetido.hashActual,imputacion,session);
   return {duplicado:true,compensacion:repetido,...(e?{recibo:require("./restauracionCicloPagoPersonal.service").recibo(usuarioId,prestamoId,fuente,idempotencyKey,anulacionHash,repetido.hashActual,imputacion,e)}:{})};
  }
  const cierre=await require("./restauracionCicloPagoPersonal.service").resolverCierreEnSesion(usuarioId,prestamoId,fuente,idempotencyKey,anulacionHash,imputacion,cadena,session,{cerrarRechazo});
  if(cierre)return cierre;
  if(!estado.anulado||historial.at(-1)?.tipo!=="ANULACION"||historial.at(-1)?.hashActual!==anulacionHash)
   throw problema("La anulación cambió; consulta antes de restaurar el pago");
  await serializarEscrituraFuente(usuarioId,session);
  const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]},periodicidadConfirmada:true}).session(session);
  if(!p)throw problema("Préstamo sin calendario confirmado o no activo");
  const {pagos}=validarPagosCredito(p,await pagosCreditoVigentes(usuarioId,prestamoId,{session}));
  if(original.numeroCuota!==pagos.length+1||!Number.isSafeInteger(p.cuotaMinor)||p.cuotaMinor<1||
   original.montoMinor!==Math.min(p.cuotaMinor,p.saldoMinor,original.montoPagadoRealMinor))
   throw problema("Pago fuera de secuencia o capital incompatible con el saldo actual");
  const saldo=p.saldoMinor-original.montoMinor;
  // Validar también la fuente que se recupera y el total de pagos reales, sin
  // inferir capital histórico ni recalcular cargos/intereses de la operación.
  validarPagosCredito({...p.toObject(),saldoMinor:saldo},[...pagos,fuente]);
  if(imputacion!==undefined)require("./restauracionCicloPagoPersonal.service").validarCambioFecha(fuente,p);
  else if(fuente.cicloCuota!==undefined&&!require("./cicloPagoPrestamoPersonal.service").coincide(fuente,p))throw problema("El ciclo del pago no coincide; revisa el vencimiento antes de restaurar");
  const compensacion=await registrar({original,tipo:"RESTAURACION",anulacionHash,idempotencyKey,fechaISO:new Date().toISOString()},{session});
  const eventoImputacion=imputacion===undefined?null:await require("./restauracionCicloPagoPersonal.service").registrarEnSesion(usuarioId,p,fuente,idempotencyKey,anulacionHash,compensacion.hashActual,imputacion,session);
  if(original.impactoCaja){
   const delta=Number(BigInt(compensacion.deltaCajaMinor));
   const cuenta=await Cuenta.findOneAndUpdate({_id:fuente.cuentaId,usuarioId,activa:true,moneda:"COP",...filtroSaldoSeguro(delta)},
    {$inc:{saldoMinor:delta}},{session,returnDocument:"after"});
   if(!cuenta||!Number.isSafeInteger(cuenta.saldoMinor))throw problema("Cuenta no disponible o saldo insuficiente para restaurar el pago");
  }
  p.saldoMinor=saldo;
  if(saldo===0){p.estado="PAGADO";p.periodicidadConfirmada=false;}
  await p.save({session});
  await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_PATRIMONIAL",aggregateId:fuente._id,
   payload:{accion:"RESTAURACION_PAGO_DEUDA",prestamoId:String(prestamoId),transaccionId:String(movimientoId),
    numeroCuota:original.numeroCuota,montoMinor:original.montoMinor,montoPagadoRealMinor:original.montoPagadoRealMinor,
    impactoCaja:original.impactoCaja,anulacionHash,compensacionHash:compensacion.hashActual,secuencia:compensacion.secuencia,
    deltaCajaMinor:compensacion.deltaCajaMinor,saldoPendienteMinor:saldo}}],{session});
  return {duplicado:false,compensacion,...(eventoImputacion?{recibo:require("./restauracionCicloPagoPersonal.service").recibo(usuarioId,prestamoId,fuente,idempotencyKey,anulacionHash,compensacion.hashActual,imputacion,eventoImputacion)}:{})};
 },config);}catch(e){if(e.code===11000)throw problema("Operación concurrente; consulta antes de reintentar");throw e;}
 finally{await session.endSession();}
}
async function prepararRestauracion(usuarioId,prestamoId,movimientoId){
 if(![usuarioId,prestamoId,movimientoId].every(x=>mongoose.isObjectIdOrHexString(x)))throw problema("Identificadores inválidos",400);const session=await mongoose.startSession();
 try{return await session.withTransaction(async()=>{
  const fuente=await Tx.findOne({_id:movimientoId,usuarioId,prestamoId,tipo:"PAGO_DEUDA",estado:"ACTIVA"}).session(session).lean();if(!fuente)throw problema("Pago no encontrado",404);
  const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]},periodicidadConfirmada:true}).session(session).lean();if(!p)throw problema("Préstamo no activo o sin calendario confirmado");
  let original;try{original=originalDesdeFuente(fuente);}catch{throw problema("Capital y pago real no conciliables");}const {cadena}=await leerCadenaVerificada(String(usuarioId),{session}),historia=cadena.filter(e=>e.movimientoId===String(movimientoId)),estado=vigente(original,historia),ultima=historia.at(-1);if(!estado.anulado||ultima?.tipo!=="ANULACION")throw problema("El pago no tiene una anulación vigente");
  const {pagos}=validarPagosCredito(p,await pagosCreditoVigentes(usuarioId,prestamoId,{session}));if(original.numeroCuota!==pagos.length+1||original.montoMinor!==Math.min(p.cuotaMinor,p.saldoMinor,original.montoPagadoRealMinor))throw problema("Capital o secuencia incompatibles con el saldo actual");validarPagosCredito({...p,saldoMinor:p.saldoMinor-original.montoMinor},[...pagos,fuente]);
  const cambio=require("./restauracionCicloPagoPersonal.service").validarCambioFecha(fuente,p),I=require("./imputacionPagoPersonal.service"),map=await I.leerEnSesion(usuarioId,[p],session);
  return{soloLectura:true,afectaCaja:false,autorizaGasto:false,noRecalculaIntereses:true,alcance:"CUOTA_PERIODICIDAD_DIA_CONFIRMACION_FECHA",noGarantizaDisponibilidad:true,prestamoId:String(p._id),movimientoId:String(fuente._id),anulacionHash:ultima.hashActual,capitalMinor:original.montoMinor,montoPagadoRealMinor:original.montoPagadoRealMinor,debitoCuentaMinor:original.impactoCaja?original.montoPagadoRealMinor:0,cuentaId:fuente.cuentaId?String(fuente.cuentaId):null,cicloOriginal:cambio.original,contextoActual:cambio.actual,revisionImputacion:p.imputacionRevision??0,fuenteHash:I.fuenteHash(fuente),eventoEsperado:map.get(String(fuente._id))?.hashActual??null};
 },{readConcern:{level:"snapshot"},readPreference:"primary"});}finally{await session.endSession();}
}
module.exports={prepararRestauracion,pagosCreditoVigentes,validarPagosCredito,obtenerPagosCredito,deshacer,restaurar};
