"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto");
const Accion=require("../models/accionProgresoPersonal.model");
const Tx=require("../models/TransaccionPersonal");
const Prestamo=require("../models/prestamoPersonal.model");
const Outbox=require("../models/outboxPersonal.model");
const {consultarPeriodo}=require("./consultaCompensadaPersonal.service");
const {serializarEscrituraFuente}=require("./proteccionOriginalCompensadoPersonal.service");
const error=(mensaje,statusCode=422)=>Object.assign(new Error(mensaje),{statusCode});
function validarEvidencia(movimiento,palanca,resultadoMinor){
 if(!movimiento||movimiento.estado!=="ACTIVA"||movimiento.moneda!=="COP"||
  !Number.isSafeInteger(movimiento.montoMinor)||movimiento.montoMinor<1||
  !(movimiento.fecha instanceof Date)||!Number.isFinite(+movimiento.fecha)||+movimiento.fecha>Date.now())
  throw error("La evidencia contable no está vigente o requiere revisión");
 const tipos={INGRESOS:["INGRESO"],COBRO:["COBRO_PRESTAMO","INGRESO"],GASTO:["GASTO"],DEUDA:["PAGO_DEUDA"]};
 if(!(tipos[palanca]||[]).includes(movimiento.tipo)||palanca==="COBRO"&&!movimiento.prestamoId)
  throw error("El movimiento no corresponde a la palanca económica de la acción");
 if(!Number.isSafeInteger(resultadoMinor)||resultadoMinor<0||resultadoMinor>movimiento.montoMinor)
  throw error("El resultado declarado supera el movimiento vigente o no es un importe exacto");
 return {transaccionId:String(movimiento._id),tipo:movimiento.tipo,montoMinor:movimiento.montoMinor,
  fecha:movimiento.fecha.toISOString(),compensacionHash:movimiento.compensacionHash||null};
}
async function actualizarAccion(usuarioId,accionId,datos){
 if(!mongoose.isObjectIdOrHexString(usuarioId)||!mongoose.isObjectIdOrHexString(accionId)||
  !datos||!["APROBADA","COMPLETADA","DESCARTADA"].includes(datos.estado)||
  datos.resultadoMinor!==undefined&&(!Number.isSafeInteger(datos.resultadoMinor)||datos.resultadoMinor<0)||
  datos.evidencia!==undefined&&(typeof datos.evidencia!=="string"||datos.evidencia.length>300))
  throw error("Datos de acción inválidos",400);
 if(datos.estado==="COMPLETADA"&&(datos.resultadoMinor===undefined||!mongoose.isObjectIdOrHexString(datos.transaccionEvidenciaId)))
  throw error("Para completar debes registrar resultado y movimiento financiero de respaldo");
 const session=await mongoose.startSession();
 try{
  let salida;
  await session.withTransaction(async()=>{
   if(datos.estado==="COMPLETADA")await serializarEscrituraFuente(usuarioId,session);
   const actual=await Accion.findOne({_id:accionId,usuarioId}).session(session);
   if(!actual)throw error("Acción no encontrada",404);
   const anterior=actual.estado,siguiente=datos.estado;
   const permitidas={PROPUESTA:["APROBADA","DESCARTADA"],APROBADA:["COMPLETADA","DESCARTADA"],COMPLETADA:[],DESCARTADA:[]};
   if(!(permitidas[anterior]||[]).includes(siguiente))throw error("Transición de acción no permitida",409);
   let evidenciaContable=null;
   if(siguiente==="COMPLETADA"){
    const fuente=await Tx.findOne({_id:datos.transaccionEvidenciaId,usuarioId}).session(session).lean();
    if(!fuente||!(fuente.fecha instanceof Date)||!Number.isFinite(+fuente.fecha))throw error("Evidencia contable no encontrada");
    const movimientos=await consultarPeriodo({usuarioId,desde:fuente.fecha.toISOString(),
     hasta:new Date(+fuente.fecha+1).toISOString(),incluirAnuladas:true},{session});
    const vigente=movimientos.find(m=>String(m._id)===String(fuente._id));
    evidenciaContable=validarEvidencia(vigente,actual.palanca,datos.resultadoMinor);
    if(actual.palanca==="COBRO"&&!await Prestamo.exists({_id:vigente.prestamoId,usuarioId,direccion:"POR_COBRAR",estado:{$ne:"CANCELADO"}}).session(session))
     throw error("La evidencia no corresponde a una cuenta por cobrar del usuario");
    actual.transaccionEvidenciaId=fuente._id;actual.completadaEn=new Date();
   }
   actual.estado=siguiente;
   if(datos.resultadoMinor!==undefined)actual.resultadoMinor=datos.resultadoMinor;
   if(datos.evidencia!==undefined)actual.evidencia=datos.evidencia;
   await actual.save({session});
   await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"ACCION_PROGRESO_ACTUALIZADA",
    aggregateType:"ACCION_PROGRESO_PERSONAL",aggregateId:actual._id,
    payload:{accionId:String(actual._id),estadoAnterior:anterior,estadoNuevo:siguiente,palanca:actual.palanca,
     objetivoMinor:actual.objetivoMinor,resultadoMinor:actual.resultadoMinor,
     transaccionEvidenciaId:actual.transaccionEvidenciaId?String(actual.transaccionEvidenciaId):null,evidenciaContable}}],{session});
   salida=actual.toObject();
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  return salida;
 }finally{await session.endSession();}
}
module.exports={actualizarAccion,validarEvidencia};
