"use strict";
const mongoose=require("mongoose");
const Movimiento=require("../models/TransaccionPersonal");
const Evento=require("../models/EventoCompensatorioPersonal");
const Cursor=require("../models/CursorCompensacionPersonal");
const Reserva=require("../models/reservaCuotaRecurrente.model");
const Cancelacion=require("../models/CancelacionObligacionPrevistaPersonal");
const {conciliarCuotasConCadenaVerificada}=
 require("./conciliarCuotasConCadenaPersonal.service");
const {periodoRecurrenteColombia}=
 require("./vinculoRecurrenteV81.service");
const MAX=10000;
function fallo(m,statusCode=409){throw Object.assign(new Error("CONSULTA_CUOTAS: "+m),{statusCode});}
function validarReservas({usuarioId,origen,pagos,reservas}){
 const esperado=new Map(),visitados=new Set();
 for(const pago of pagos){
  const p=periodoRecurrenteColombia({
   fechaOrigen:origen.fecha,fechaPago:pago.fecha,frecuencia:origen.frecuencia
  });
  const clave=p.inicio.toISOString();
  const anterior=esperado.get(clave)||0n;
  esperado.set(clave,anterior+BigInt(pago.montoMinor));
 }
 for(const reserva of reservas){
  if(String(reserva.usuarioId)!==String(usuarioId)||
   String(reserva.origenId)!==String(origen._id)||
   !Number.isSafeInteger(reserva.reservadoMinor)||
   !Number.isSafeInteger(reserva.importeCuotaMinor)||
   reserva.reservadoMinor<0||
   reserva.importeCuotaMinor!==origen.montoMinor)
   fallo("reserva no verificable");
  const clave=new Date(reserva.periodoInicio).toISOString();
  const importe=esperado.get(clave);
  if(visitados.has(clave)||importe===undefined||
   BigInt(reserva.reservadoMinor)!==importe||
   importe>BigInt(origen.montoMinor))
   fallo("reserva inconsistente con abonos");
  visitados.add(clave);
  const primero=pagos.find(x=>
   periodoRecurrenteColombia({fechaOrigen:origen.fecha,
    fechaPago:x.fecha,frecuencia:origen.frecuencia}).inicio.toISOString()===clave);
  const periodo=periodoRecurrenteColombia({
   fechaOrigen:origen.fecha,fechaPago:primero.fecha,frecuencia:origen.frecuencia
  });
  if(new Date(reserva.periodoFin).getTime()!==periodo.fin.getTime())
   fallo("fin de reserva inconsistente");
 }
 if(visitados.size!==esperado.size)
  fallo("existen abonos sin reserva");
 return true;
}
function crearConsultaCuotasConciliadas({
 MovimientoModelo=Movimiento,EventoModelo=Evento,CursorModelo=Cursor,
 ReservaModelo=Reserva,CancelacionModelo=Cancelacion,
 nuevaSesion=()=>mongoose.startSession()
}={}){
 return async function consultar(usuarioId,origenId,{desde,hasta}={}){
  if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(origenId))
   fallo("identificadores inválidos",400);
  const uid=String(usuarioId),session=await nuevaSesion();
  try{
   let resultado;
   await session.withTransaction(async()=>{
    const origen=await MovimientoModelo.findOne({
     _id:origenId,usuarioId,tipo:"GASTO",impactoCaja:false,
     cuentaId:null,cuenta:"SIN_CAJA",estado:"ACTIVA"
    }).session(session).lean();
    if(!origen)fallo("obligación no encontrada",404);
    const [pagos,eventos,cursor,reservas,cancelacion]=await Promise.all([
     MovimientoModelo.find({usuarioId,recurrenteOrigenId:origen._id})
      .limit(MAX+1).session(session).lean(),
     EventoModelo.find({usuarioId:uid}).sort({secuencia:1})
      .limit(MAX+1).session(session).lean(),
     CursorModelo.findById(uid).session(session).lean(),
     ReservaModelo.find({usuarioId,origenId:origen._id})
      .limit(MAX+1).session(session).lean(),
     CancelacionModelo.findOne({usuarioId,obligacionId:origen._id})
      .session(session).lean()
    ]);
    if([pagos,eventos,reservas].some(x=>!Array.isArray(x)||x.length>MAX))
     fallo("historial no verificable o truncado",503);
    if(cancelacion)fallo("obligación cancelada; no conciliar abonos contra ella");
    validarReservas({usuarioId:uid,origen,pagos,reservas});
    resultado=conciliarCuotasConCadenaVerificada({
     usuarioId:uid,origen,pagos,eventos,cursor,desde,hasta
    });
    resultado={...resultado,fuenteDatos:"SNAPSHOT_MONGO_COMPLETO_CON_RESERVAS",
     soloLectura:true,aptoParaDisponibleHoy:false};
   },{readConcern:{level:"snapshot"},readPreference:"primary"});
   return resultado;
  }finally{await session.endSession();}
 };
}
module.exports={crearConsultaCuotasConciliadas,validarReservas,MAX};
