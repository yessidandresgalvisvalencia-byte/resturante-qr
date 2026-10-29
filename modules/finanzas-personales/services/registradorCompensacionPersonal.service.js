"use strict";
const mongoose=require("mongoose");
const Cursor=require("../models/CursorCompensacionPersonal");
const Evento=require("../models/EventoCompensatorioPersonal");
const {eventoCompensatorio,verificarCadena}=require("./eventoCompensatorioPersonal.service");
const {vigente}=require("./estadoCompensadoPersonal.service");
const {indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const GENESIS="0".repeat(64);
const MAX_EVENTOS=10000;
const ID=/^[A-Za-z0-9_-]{1,128}$/;

function conflicto(mensaje){
 return Object.assign(new Error(mensaje),{statusCode:409});
}
function verificarIndices(indices,nombre,campos){
 // MongoDB omite `unique` en la especificación del índice _id_, que es único por definición.
 return Array.isArray(indices)&&campos.every(([,v])=>v===1)&&indices.some(i=>i?.name===nombre&&
  indiceExacto([{...i,unique:nombre==="_id_"&&i.unique===undefined?true:i.unique}],campos.map(([k])=>k)));
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
async function leerCadenaVerificada(usuarioId,{session,EventoModelo=Evento,CursorModelo=Cursor,paraAnexar=false}={}){
 if(typeof usuarioId!=="string"||!ID.test(usuarioId)||!session?.inTransaction?.())
  throw new TypeError("Usuario y transacción activa requeridos para verificar la cadena");
 const cadena=await EventoModelo.find({usuarioId},{_id:0})
  .sort({secuencia:1}).limit(MAX_EVENTOS+1).maxTimeMS(5000).session(session).lean();
 if(cadena.length>MAX_EVENTOS||paraAnexar&&cadena.length===MAX_EVENTOS)
  throw Object.assign(new Error("Ledger compensatorio alcanza el límite verificable; requiere ampliación de capacidad"),{statusCode:422});
 const cursor=await CursorModelo.findById(usuarioId).session(session).lean();
 let cadenaValida=false;
 try{cadenaValida=verificarCadena(cadena,{prevHash:GENESIS});}catch(_){}
 if(!cadenaValida||cadena.some(e=>e.usuarioId!==usuarioId)||(!cursor&&cadena.length)||
    (cursor&&(cursor.secuencia!==cadena.length||cursor.hashActual!==(cadena.at(-1)?.hashActual||GENESIS))))
  throw conflicto("INTEGRIDAD_LEDGER: cadena completa y cursor no coinciden");
 return {cadena,cursor};
}
function crearRegistrador({
 EventoModelo=Evento,CursorModelo=Cursor,
 nuevaSesion=()=>mongoose.startSession(),
 revisarIndices=()=>exigirIndices({EventoModelo,CursorModelo}),
 construir=eventoCompensatorio
}={}){
 // Una sesión externa pertenece al llamador: este debe propagar errores y confirmar/abortar
 // la unidad completa (evento, saldo, reserva y outbox). El retorno NO confirma esa transacción.
 return async function registrar({original,tipo,cambios={},idempotencyKey,fechaISO},{session:externa}={}){
  if(!original||typeof original.usuarioId!=="string"||!ID.test(original.usuarioId)||
    typeof original.movimientoId!=="string"||!ID.test(original.movimientoId)||
    typeof idempotencyKey!=="string"||!ID.test(idempotencyKey))
   throw new TypeError("Usuario e idempotencia obligatorios");
  if(externa&&(typeof externa.inTransaction!=="function"||externa.inTransaction()!==true))
   throw new TypeError("Se requiere una transacción externa activa");
  // Exigir índices REALMENTE instalados antes de cualquier escritura, no solo declarados en Mongoose.
  await revisarIndices();
  const session=externa||await nuevaSesion();
  try{
   let resultado;
   const anexar=async()=>{
    const repetido=await EventoModelo.findOne({usuarioId:original.usuarioId,idempotencyKey}).session(session).lean();
    if(repetido)throw conflicto("Idempotencia ya utilizada; no repetir la compensación");
    // Verificar toda la cadena del usuario dentro del mismo snapshot que el CAS.
    // El historial de un solo movimiento no detecta huecos en otros movimientos.
    let {cadena,cursor}=await leerCadenaVerificada(original.usuarioId,{session,EventoModelo,CursorModelo,paraAnexar:true});
    const historial=cadena.filter(e=>e.movimientoId===original.movimientoId);
    if(historial.length){
     const estado=vigente(historial[0].original,historial);
     if(estado.anulado)throw conflicto("Movimiento ya anulado; no repetir el reverso");
     if(Object.keys(estado.actual).some(k=>estado.actual[k]!==original[k]))
      throw conflicto("Estado del movimiento desactualizado; vuelve a consultar antes de corregir");
    }
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
      {session,returnDocument:"after",runValidators:true}
    );
    if(!avance)throw conflicto("Cadena financiera modificada concurrentemente; reintenta con nueva lectura");
    const insertados=await EventoModelo.create([evento],{session});
    if(!Array.isArray(insertados)||insertados.length!==1)
     throw new Error("No se confirmó inserción del evento compensatorio");
    resultado=evento;
   };
   if(externa)await anexar();
   else await session.withTransaction(anexar,{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
   return resultado;
  }catch(error){
   if(error?.code===11000)throw conflicto("Idempotencia o secuencia duplicada; no repetir sin conciliar");
   throw error;
  }finally{if(!externa)await session.endSession();}
 };
}
module.exports={crearRegistrador,exigirIndices,verificarIndices,leerCadenaVerificada,GENESIS};
