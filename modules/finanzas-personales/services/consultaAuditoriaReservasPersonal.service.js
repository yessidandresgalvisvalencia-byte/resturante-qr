"use strict";
const mongoose=require("mongoose");
const Movimiento=require("../models/TransaccionPersonal");
const Reserva=require("../models/reservaCuotaRecurrente.model");
const Evento=require("../models/EventoCompensatorioPersonal");
const Cursor=require("../models/CursorCompensacionPersonal");
const Cancelacion=require("../models/CancelacionObligacionPrevistaPersonal");
const {auditarReservasRecurrencia}=require("./auditarReservasRecurrenciaPersonal.service");
const {planearReparacionReservas}=require("./planReparacionReservasPersonal.service");
const MAX=10000;
function fallo(m,statusCode=409){
 return Object.assign(new Error("AUDITORIA_RESERVAS_SNAPSHOT: "+m),{statusCode});
}
// Nunca actualizar saldos ni reservas. Este lector NO usa datos entregados
// por el frontend: obtiene el histórico completo desde Mongo en un
// snapshot consistente y falla cerrado si se supera el límite.
function crearConsultaAuditoriaReservas({
 MovimientoModelo=Movimiento,ReservaModelo=Reserva,EventoModelo=Evento,
 CursorModelo=Cursor,CancelacionModelo=Cancelacion,
 nuevaSesion=()=>mongoose.startSession()
}={}){
 return async function consultar(usuarioId,origenId){
  if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(origenId))
   throw fallo("identificadores inválidos",400);
  const uid=String(usuarioId);
  const session=await nuevaSesion();
  try{
   let resultado;
   await session.withTransaction(async()=>{
    const origen=await MovimientoModelo.findOne({
     _id:origenId,usuarioId,tipo:"GASTO",impactoCaja:false,
     cuentaId:null,cuenta:"SIN_CAJA",estado:"ACTIVA",recurrente:true
    }).session(session).lean();
    if(!origen)throw fallo("obligación recurrente no encontrada",404);
    // Dentro de una transacción las operaciones no deben ejecutarse
    // en paralelo sobre la misma session.
    const pagos=await MovimientoModelo.find({
     usuarioId,recurrenteOrigenId:origen._id
    }).limit(MAX+1).session(session).lean();
    const reservas=await ReservaModelo.find({
     usuarioId,origenId:origen._id
    }).limit(MAX+1).session(session).lean();
    const eventos=await EventoModelo.find({usuarioId:uid})
     .sort({secuencia:1}).limit(MAX+1).session(session).lean();
    const cursor=await CursorModelo.findById(uid).session(session).lean();
    const cancelacion=await CancelacionModelo.findOne({
     usuarioId,obligacionId:origen._id
    }).session(session).lean();
    if([pagos,reservas,eventos].some(a=>!Array.isArray(a)||a.length>MAX))
     throw fallo("historial incompleto o truncado",503);
    if(cancelacion)throw fallo("obligación cancelada; revisión especial requerida");
    const auditoria=auditarReservasRecurrencia({
     usuarioId:uid,origen,pagos,reservas,eventos,cursor
    });
    const plan=planearReparacionReservas({
     usuarioId:uid,origenId:String(origen._id),auditoria
    });
    resultado={...auditoria,planReparacion:plan,
     fuenteDatos:"SNAPSHOT_MONGO_AUDITORIA",
     soloLectura:true,aptoParaDisponibleHoy:false};
   },{readConcern:{level:"snapshot"},readPreference:"primary"});
   return resultado;
  }finally{await session.endSession();}
 };
}
module.exports={crearConsultaAuditoriaReservas,MAX};
