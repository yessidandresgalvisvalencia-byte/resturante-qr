"use strict";
const crypto=require("node:crypto");
const mongoose=require("mongoose");
const Movimiento=require("../models/TransaccionPersonal");
const Cancelacion=require("../models/CancelacionObligacionPrevistaPersonal");
const Reserva=require("../models/reservaCuotaRecurrente.model");
function conflicto(m,statusCode=409){return Object.assign(new Error(m),{statusCode});}
const KEYS=[["usuarioId",1],["obligacionId",1]];
function tieneIndice(indices,campos){
 return indices.some(i=>i.unique===true&&Object.keys(i.key||{}).length===campos.length&&
  campos.every(([key,n])=>i.key[key]===n));
}
async function exigirIndices(Modelo){
 let indices;
 try{indices=await Modelo.collection.indexes();}
 catch(_){throw conflicto("Índices de cancelaciones no verificables",503);}
 if(!tieneIndice(indices,KEYS)||!tieneIndice(indices,[["usuarioId",1],["idempotencyHash",1]]))
  throw conflicto("Índices únicos de cancelación no disponibles",503);
}
function crearCanceladorObligacion({
 MovimientoModelo=Movimiento,CancelacionModelo=Cancelacion,ReservaModelo=Reserva,
 nuevaSesion=()=>mongoose.startSession(),
 verificar=()=>exigirIndices(CancelacionModelo)
}={}){
 return async function cancelar(usuarioId,id,{idempotencyKey,motivo}={}){
  if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(id)||
     typeof idempotencyKey!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(idempotencyKey)||
     typeof motivo!=="string"||!motivo.trim()||motivo.trim().length>240)
   throw conflicto("Datos de cancelación inválidos",400);
  const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;
  if(typeof secret!=="string"||!secret)throw conflicto("Clave de idempotencia ausente",503);
  const idempotencyHash=crypto.createHmac("sha256",secret)
   .update(String(usuarioId)).update(":cancelacion:")
   .update(idempotencyKey).digest("hex");
  await verificar();
  const session=await nuevaSesion();
  try{
   let salida;
   await session.withTransaction(async()=>{
    const original=await MovimientoModelo.findOne({
     _id:id,usuarioId,tipo:"GASTO",impactoCaja:false,
     cuentaId:null,cuenta:"SIN_CAJA",estado:"ACTIVA",
     origen:"MANUAL"
    }).session(session).lean();
    if(!original)throw conflicto("Obligación prevista no disponible");
    // No cancelar de forma silenciosa una obligación que ya recibió
    // abonos o reservas históricas. El cierre de esas relaciones necesita
    // un flujo compensatorio completo.
    const abonada=await MovimientoModelo.exists({
     usuarioId,recurrenteOrigenId:original._id
    }).session(session);
    const reservada=await ReservaModelo.exists({
     usuarioId,origenId:original._id
    }).session(session);
    if(abonada||reservada)
     throw conflicto("Obligación con pagos o reservas: requiere conciliación");

    const evento={
     usuarioId:original.usuarioId,obligacionId:original._id,
     idempotencyHash,tipo:"CANCELACION_OBLIGACION_PREVISTA",
     fecha:new Date(),motivo:motivo.trim(),
     snapshot:{montoMinor:original.montoMinor,concepto:original.concepto,
      categoria:original.categoria,fecha:original.fecha,
      frecuencia:original.frecuencia,recurrente:original.recurrente}
    };
    const creados=await CancelacionModelo.create([evento],{session});
    if(!Array.isArray(creados)||creados.length!==1)
     throw conflicto("No se confirmó la cancelación",503);
    salida=creados[0];
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
   return salida;
  }catch(e){
   if(e?.code===11000)throw conflicto("Obligación cancelada o clave de idempotencia reutilizada");
   throw e;
  }finally{await session.endSession();}
 };
}
module.exports={crearCanceladorObligacion,exigirIndices};
