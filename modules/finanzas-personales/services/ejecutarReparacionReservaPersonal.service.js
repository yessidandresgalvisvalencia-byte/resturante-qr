"use strict";
// EJECUTOR INTERNO RESTRINGIDO: repara solamente UNA reserva existente.
// No exportar a HTTP ni conectarlo a Home sin revisión de privilegios DB.
const mongoose=require("mongoose");
const Movimiento=require("../models/TransaccionPersonal");
const Reserva=require("../models/reservaCuotaRecurrente.model");
const Evento=require("../models/EventoCompensatorioPersonal");
const Cursor=require("../models/CursorCompensacionPersonal");
const Cancelacion=require("../models/CancelacionObligacionPrevistaPersonal");
const Evidencia=require("../models/EventoReconciliacionReservaPersonal");
const {huellaEstadoReservas,verificarHuellaEstado}=
 require("./huellaEstadoReservasPersonal.service");
const {auditarReservasRecurrencia}=require("./auditarReservasRecurrenciaPersonal.service");
const {planearReparacionReservas}=require("./planReparacionReservasPersonal.service");
const {verificarVigenciaPlanReservas}=
 require("./verificarVigenciaPlanReservasPersonal.service");
const {prepararCondicionCasReserva}=require("./condicionCasReservaPersonal.service");
const {construirEventoReconciliacionReserva}=
 require("./eventoReconciliacionReservaPersonal.service");
const MAX=10000,GENESIS="0".repeat(64);
const HEX=/^[a-f0-9]{64}$/;
function fallo(m,statusCode=409){return Object.assign(
 new Error("EJECUTOR_RESERVA: "+m),{statusCode});}
function comprobarIndice(indices){
 return indices.some(i=>i.name==="fp_reconciliacion_reservas_idempotencia_v1"&&
  i.unique===true&&i.key?.usuarioId===1&&i.key?.idempotencyHash===1&&
  Object.keys(i.key).length===2);
}
function crearEjecutorReparacionReserva({
 MovimientoModelo=Movimiento,ReservaModelo=Reserva,EventoModelo=Evento,
 CursorModelo=Cursor,CancelacionModelo=Cancelacion,EvidenciaModelo=Evidencia,
 nuevaSesion=()=>mongoose.startSession()
}={}){
 return async function ejecutar({usuarioId,origenId,reservaId,huellaEstadoEsperada,
  huellaDiagnostico,idempotencyHash,fecha=new Date()}={}){
  if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(origenId)||
     !mongoose.isValidObjectId(reservaId)||
     ![huellaEstadoEsperada,huellaDiagnostico,idempotencyHash]
      .every(x=>typeof x==="string"&&HEX.test(x))||
     !(fecha instanceof Date)||!Number.isFinite(fecha.getTime()))
   throw fallo("identidad, huellas o fecha inválidas",400);
  // Un índice declarado en Mongoose pero no creado en DB no es garantía.
  let indices;
  try{indices=await EvidenciaModelo.collection.indexes();}
  catch(_){throw fallo("índices de idempotencia no verificables",503);}
  if(!comprobarIndice(indices))throw fallo("falta índice único de idempotencia",503);
  const uid=String(usuarioId),session=await nuevaSesion();
  try{
   let resultado;
   await session.withTransaction(async()=>{
    const duplicado=await EvidenciaModelo.findOne({
     usuarioId,idempotencyHash
    }).session(session).lean();
    if(duplicado)throw fallo("idempotencia ya utilizada");
    const origen=await MovimientoModelo.findOne({
     _id:origenId,usuarioId,tipo:"GASTO",impactoCaja:false,
     cuentaId:null,cuenta:"SIN_CAJA",estado:"ACTIVA",recurrente:true
    }).session(session).lean();
    if(!origen)throw fallo("obligación no encontrada");
    const pagos=await MovimientoModelo.find({usuarioId,recurrenteOrigenId:origen._id})
     .limit(MAX+1).session(session).lean();
    const reservas=await ReservaModelo.find({usuarioId,origenId:origen._id})
     .limit(MAX+1).session(session).lean();
    const eventos=await EventoModelo.find({usuarioId:uid})
     .sort({secuencia:1}).limit(MAX+1).session(session).lean();
    let cursor=await CursorModelo.findById(uid).session(session).lean();
    const cancelacion=await CancelacionModelo.findOne({
     usuarioId,obligacionId:origen._id
    }).session(session).lean();
    if(cancelacion||[pagos,reservas,eventos].some(a=>!Array.isArray(a)||a.length>MAX))
     throw fallo("cancelación o historial incompleto",503);
    const huella=huellaEstadoReservas({
     usuarioId:uid,origen,pagos,reservas,eventos,cursor,cancelacion
    });
    verificarHuellaEstado(huella,huellaEstadoEsperada);
    const auditoria=auditarReservasRecurrencia({
     usuarioId:uid,origen,pagos,reservas,eventos,cursor
    });
    verificarVigenciaPlanReservas({usuarioId:uid,origenId:String(origen._id),
     huellaEsperada:huellaDiagnostico,auditoriaActual:auditoria});
    const plan=planearReparacionReservas({
     usuarioId:uid,origenId:String(origen._id),auditoria
    });
    // Reparaciones mixtas o múltiples requieren un flujo dedicado.
    if(plan.acciones.length!==1||
       plan.acciones[0].codigo!=="RESERVA_DESCUADRADA")
     throw fallo("solo se admite una discrepancia de reserva existente");
    const accion=plan.acciones[0];
    const reserva=reservas.find(r=>String(r._id)===String(reservaId)&&
     new Date(r.periodoInicio).toISOString()===accion.periodoInicio);
    if(!reserva)throw fallo("reserva de la discrepancia no identificada");
    const nuevo=BigInt(accion.esperadoMinor);
    if(nuevo>BigInt(Number.MAX_SAFE_INTEGER))throw fallo("importe no representable");
    const cas=prepararCondicionCasReserva({
     usuarioId:uid,origenId:String(origen._id),reserva,
     importeEsperadoMinor:reserva.reservadoMinor,importeNuevoMinor:Number(nuevo)
    });
    const evidencia=construirEventoReconciliacionReserva({
     usuarioId:uid,origenId:String(origen._id),reservaId:String(reserva._id),
     periodoInicio:new Date(reserva.periodoInicio),
     huellaEstadoPrevio:huellaEstadoEsperada,
     huellaDiagnostico,idempotencyHash,
     importeAnteriorMinor:String(reserva.reservadoMinor),
     importeNuevoMinor:accion.esperadoMinor,fecha
    });
    // Fence del cursor compartido con el ledger compensatorio. Si no existía,
    // insertarlo en esta transacción; no altera la secuencia de eventos.
    if(!cursor){
     await CursorModelo.create([{_id:uid,secuencia:0,
      hashActual:GENESIS,revisionLegada:0}],{session});
     cursor={secuencia:0,hashActual:GENESIS,revisionLegada:0};
    }
    if(!Number.isSafeInteger(cursor.revisionLegada??0)||
       (cursor.revisionLegada??0)>=Number.MAX_SAFE_INTEGER)
     throw fallo("revisión de concurrencia inválida");
    const fence=await CursorModelo.updateOne({
     _id:uid,secuencia:cursor.secuencia,hashActual:cursor.hashActual,
     revisionLegada:cursor.revisionLegada??0
    },{$inc:{revisionLegada:1}},{session});
    if(fence.matchedCount!==1)throw fallo("cursor modificado concurrentemente");
    const actualizado=await ReservaModelo.updateOne(cas.filtro,
     {$set:{reservadoMinor:cas.importeNuevoMinor}},{session,runValidators:true});
    if(actualizado.matchedCount!==1||actualizado.modifiedCount!==1)
     throw fallo("reserva cambió concurrentemente");
    const [guardado]=await EvidenciaModelo.create([{
     ...evidencia,usuarioId:origen.usuarioId,origenId:origen._id,
     reservaId:reserva._id,periodoInicio:new Date(evidencia.periodoInicio),
     fecha:new Date(evidencia.fecha)
    }],{session});
    if(!guardado?._id)throw fallo("evento append-only no confirmado");
    resultado={eventoId:String(guardado._id),hashEvento:evidencia.hashEvento,
     deltaMinor:evidencia.deltaMinor,soloReparacionReserva:true,
     saldoCajaAlterado:false,aptoParaDisponibleHoy:false};
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},
    readPreference:"primary"});
   return resultado;
  }catch(err){
   if(err?.code===11000)throw fallo("idempotencia duplicada o carrera concurrente");
   throw err;
  }finally{await session.endSession();}
 };
}
module.exports={crearEjecutorReparacionReserva};
