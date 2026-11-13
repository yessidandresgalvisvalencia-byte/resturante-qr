"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto");
const Prestamo=require("../models/prestamoPersonal.model");
const Outbox=require("../models/outboxPersonal.model");
const {consultarPeriodo}=require("./consultaCompensadaPersonal.service");
const {crearRegistrador}=require("./registradorCompensacionPersonal.service");
const {serializarEscrituraFuente}=require("./proteccionOriginalCompensadoPersonal.service");
const registrar=crearRegistrador();
const problema=(m,statusCode=409)=>Object.assign(new Error(m),{statusCode});
const config={readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"};
function verificarCuenta(p,usuarioId){
 if(!p||String(p.usuarioId)!==String(usuarioId)||p.direccion!=="POR_COBRAR")throw problema("Cuenta no encontrada",404);
 if(!["ACTIVO","VENCIDO","PAGADO"].includes(p.estado)||!Number.isSafeInteger(p.principalMinor)||p.principalMinor<1||
  !Number.isSafeInteger(p.saldoMinor)||p.saldoMinor<0||p.saldoMinor>p.principalMinor)
  throw problema("Cuenta por cobrar no conciliable");
}
function cobrosConciliados(p,movimientos){
 const cobros=movimientos.filter(m=>String(m.prestamoId)===String(p._id)&&["INGRESO","COBRO_PRESTAMO"].includes(m.tipo));
 let total=0n;
 for(const m of cobros){
  if(!Number.isSafeInteger(m.montoMinor)||m.montoMinor<1||![true,false].includes(m.impactoCaja)||
   m.moneda!=="COP"||m.recurrente||m.recurrenteOrigenId||m.medioPago==="CREDITO"||
   !(m.fecha instanceof Date)||!Number.isFinite(+m.fecha)||+m.fecha>Date.now())
   throw problema("Cobro histórico no conciliable");
  total+=BigInt(m.montoMinor);
 }
 if(!cobros.length||total!==BigInt(p.principalMinor)-BigInt(p.saldoMinor))
  throw problema("Los movimientos no concuerdan con el saldo pendiente; requiere auditoría");
 return {cobros,total:Number(total)};
}
async function movimientosVigentes(usuarioId,session){
 return consultarPeriodo({usuarioId,desde:"0001-01-01T00:00:00.000Z",hasta:"9999-12-31T23:59:59.999Z"},{session});
}
async function aplicar(usuarioId,p,{cobros,total},session,origenNuevo="TRABAJO"){
 let reclasificados=0;
 const tipoNuevo=origenNuevo==="TRABAJO"?"INGRESO":"COBRO_PRESTAMO";
 for(const m of cobros){
  if(m.tipo===tipoNuevo)continue;
  const original={usuarioId:String(usuarioId),movimientoId:String(m._id),tipo:m.tipo,
   montoMinor:m.montoMinor,concepto:m.concepto,categoria:m.categoria};
  const evento=await registrar({original,tipo:"CORRECCION",cambios:{tipo:tipoNuevo,categoria:tipoNuevo==="INGRESO"?"Trabajo cobrado":"Cuentas por cobrar"},
   idempotencyKey:"clasif_"+tipoNuevo+"_"+String(m._id)+"_"+(m.compensacionHash||"original"),fechaISO:new Date().toISOString()},{session});
  if(evento.deltaCajaMinor!=="0")throw problema("Reclasificación con efecto de caja inesperado");
  await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_CORREGIDO",aggregateId:m._id,
   payload:{transaccionId:String(m._id),prestamoId:String(p._id),accion:"RECLASIFICACION_"+origenNuevo,
    compensacionHash:evento.hashActual,secuencia:evento.secuencia,deltaCajaMinor:"0",antes:original,
    despues:{...original,...evento.cambios}}}],{session});
  reclasificados++;
 }
 if(p.origenCuentaPorCobrar!==origenNuevo){
  p.origenCuentaPorCobrar=origenNuevo;await p.save({session});
 }
 return {reclasificados,ingresoTrabajoMinor:origenNuevo==="TRABAJO"?total:0,saldoPendienteMinor:p.saldoMinor};
}
// El llamador conserva la propiedad de la transacción que también modifica el préstamo.
async function reclasificarOrigenEnSesion(usuarioId,p,origenNuevo,session){
 if(!session?.inTransaction()||!["TRABAJO","PRESTAMO"].includes(origenNuevo))throw problema("Reclasificación no permitida");
 await serializarEscrituraFuente(usuarioId,session);
 verificarCuenta(p,usuarioId);
 return aplicar(usuarioId,p,cobrosConciliados(p,await movimientosVigentes(usuarioId,session)),session,origenNuevo);
}
async function enTransaccion(usuarioId,operacion){
 if(!mongoose.isObjectIdOrHexString(usuarioId))throw problema("Usuario inválido",400);
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   await serializarEscrituraFuente(usuarioId,session);
   return operacion(session);
  },config);
 }catch(e){
  if(e.code===11000)throw problema("Reparación concurrente; vuelve a consultar antes de reintentar");
  throw e;
 }finally{await session.endSession();}
}
async function corregirOrigenTrabajo(usuarioId,prestamoId){
 if(!mongoose.isObjectIdOrHexString(prestamoId))throw problema("Cuenta inválida",400);
 return enTransaccion(usuarioId,async session=>{
  const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_COBRAR"}).session(session);
  verificarCuenta(p,usuarioId);
  const estado=cobrosConciliados(p,await movimientosVigentes(usuarioId,session));
  return aplicar(usuarioId,p,estado,session);
 });
}
async function reconciliarIngresosTrabajo(usuarioId){
 return enTransaccion(usuarioId,async session=>{
  const trabajos=await Prestamo.find({usuarioId,direccion:"POR_COBRAR",saldoMinor:0,estado:{$ne:"CANCELADO"}})
   .sort({_id:1}).limit(501).maxTimeMS(5000).session(session);
  if(trabajos.length>500)throw problema("Demasiadas cuentas para una reparación verificable",422);
  const movimientos=trabajos.some(p=>p.origenCuentaPorCobrar==="TRABAJO")?await movimientosVigentes(usuarioId,session):[];
  let corregidos=0,requierenRevisionManual=0;
  for(const p of trabajos){
   let estado;
   try{
    verificarCuenta(p,usuarioId);
    if(p.origenCuentaPorCobrar!=="TRABAJO")throw problema("Origen no confirmado como trabajo");
    estado=cobrosConciliados(p,movimientos);
   }catch(e){if(e.statusCode!==409)throw e;requierenRevisionManual++;continue;}
   // Un fallo de persistencia se propaga: no confirmar reparaciones parciales.
   corregidos+=(await aplicar(usuarioId,p,estado,session)).reclasificados;
  }
  return {corregidos,requierenRevisionManual,
   estado:corregidos>0?"CORREGIDO":requierenRevisionManual>0?"REQUIERE_REVISION":"SIN_CAMBIOS"};
 });
}
module.exports={corregirOrigenTrabajo,reconciliarIngresosTrabajo,reclasificarOrigenEnSesion};
