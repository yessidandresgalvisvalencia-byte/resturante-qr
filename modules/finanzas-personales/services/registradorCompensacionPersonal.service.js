"use strict";
const mongoose=require("mongoose");
const Cursor=require("../models/CursorCompensacionPersonal");
const Evento=require("../models/EventoCompensatorioPersonal");
const {eventoCompensatorio}=require("./eventoCompensatorioPersonal.service");
const GENESIS="0".repeat(64);
const ID=/^[A-Za-z0-9_-]{1,128}$/;

function conflicto(mensaje){
 return Object.assign(new Error(mensaje),{statusCode:409});
}
function verificarIndices(indices,nombre,campos){
 return indices.some(i=>i.name===nombre&&i.unique===true&&
  !i.partialFilterExpression&&i.sparse!==true&&
  Object.keys(i.key||{}).length===campos.length&&campos.every(([k,v])=>i.key[k]===v));
}
async function exigirIndices({EventoModelo=Evento,CursorModelo=Cursor}={}){
 let indices,cursores;
 try{
  [indices,cursores]=await Promise.all([EventoModelo.collection.indexes(),CursorModelo.collection.indexes()]);
 }catch(_){throw Object.assign(new Error("Índices del ledger compensatorio no verificables"),{statusCode:503});}
 if(!verificarIndices(indices,"fp_compensacion_idempotencia_usuario_v1",[["usuarioId",1],["idempotencyKey",1]])||
  !verificarIndices(indices,"fp_compensacion_orden_usuario_v1",[["usuarioId",1],["secuencia",1]])||
  !verificarIndices(cursores,"_id_",[["_id",1]]))
  throw Object.assign(new Error("Falta un índice único para la seguridad del ledger"),{statusCode:503});
}
function crearRegistrador({
 EventoModelo=Evento,CursorModelo=Cursor,
 nuevaSesion=()=>mongoose.startSession(),
 revisarIndices=()=>exigirIndices({EventoModelo,CursorModelo}),
 construir=eventoCompensatorio
}={}){
 return async function registrar({original,tipo,cambios={},idempotencyKey,fechaISO}){
  if(!original||typeof original.usuarioId!=="string"||!ID.test(original.usuarioId)||
    typeof idempotencyKey!=="string"||!ID.test(idempotencyKey))
   throw new TypeError("Usuario e idempotencia obligatorios");
  // Exigir índices REALMENTE instalados antes de cualquier escritura, no solo declarados en Mongoose.
  await revisarIndices();
  const session=await nuevaSesion();
  try{
   let resultado;
   await session.withTransaction(async()=>{
    const repetido=await EventoModelo.findOne({usuarioId:original.usuarioId,idempotencyKey}).session(session).lean();
    if(repetido)throw conflicto("Idempotencia ya utilizada; no repetir la compensación");
    let cursor=await CursorModelo.findById(original.usuarioId).session(session).lean();
    if(!cursor){
     await CursorModelo.create([{_id:original.usuarioId,secuencia:0,hashActual:GENESIS}],{session});
     cursor={_id:original.usuarioId,secuencia:0,hashActual:GENESIS};
    }
    if(!Number.isSafeInteger(cursor.secuencia)||cursor.secuencia<0||
       typeof cursor.hashActual!=="string"||!(/^[a-f0-9]{64}$/).test(cursor.hashActual)||
       cursor.secuencia>=Number.MAX_SAFE_INTEGER)
     throw conflicto("Cursor del ledger inconsistente");
    const evento=construir({original,tipo,cambios,idempotencyKey,fechaISO,
      prevHash:cursor.hashActual,secuencia:cursor.secuencia+1});
    // El cursor CAS coordina la escritura por usuario. Una carrera aborta toda la transacción.
    const avance=await CursorModelo.findOneAndUpdate(
      {_id:original.usuarioId,secuencia:cursor.secuencia,hashActual:cursor.hashActual},
      {$set:{secuencia:evento.secuencia,hashActual:evento.hashActual}},
      {session,new:true,runValidators:true}
    );
    if(!avance)throw conflicto("Cadena financiera modificada concurrentemente; reintenta con nueva lectura");
    const insertados=await EventoModelo.create([evento],{session});
    if(!Array.isArray(insertados)||insertados.length!==1)
     throw new Error("No se confirmó inserción del evento compensatorio");
    resultado=evento;
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
   return resultado;
  }catch(error){
   if(error?.code===11000)throw conflicto("Idempotencia o secuencia duplicada; no repetir sin conciliar");
   throw error;
  }finally{await session.endSession();}
 };
}
module.exports={crearRegistrador,exigirIndices,verificarIndices,GENESIS};
