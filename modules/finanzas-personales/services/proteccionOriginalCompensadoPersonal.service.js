"use strict";
const mongoose=require("mongoose");
const Cursor=require("../models/CursorCompensacionPersonal");
const Evento=require("../models/EventoCompensatorioPersonal");
const GENESIS="0".repeat(64);
async function serializarEscrituraFuente(usuarioId,session){
 if(!mongoose.isObjectIdOrHexString(usuarioId)||!session?.inTransaction())
  throw new TypeError("Usuario y transacción activa obligatorios");
 // Revisión mutable, separada de secuencia/hash financieros. Fuerza conflicto de escritura
 // entre metadatos heredados y compensaciones, incluso si no cambia el saldo de la cuenta.
 const cursor=await Cursor.findOneAndUpdate({_id:String(usuarioId),$or:[
  {revisionCompatibilidad:{$exists:false}},{revisionCompatibilidad:{$gte:0,$lt:Number.MAX_SAFE_INTEGER}}
 ]},{$inc:{revisionCompatibilidad:1},$setOnInsert:{secuencia:0,hashActual:GENESIS}},
 {session,upsert:true,returnDocument:"after"});
 if(!cursor||!Number.isSafeInteger(cursor.revisionCompatibilidad)||cursor.revisionCompatibilidad<1)
  throw Object.assign(new Error("Control de escritura incompatible; requiere revisión"),{statusCode:409});
}
async function exigirOriginalSinCompensaciones(usuarioId,movimientoId,session){
 if(!mongoose.isObjectIdOrHexString(movimientoId))throw new TypeError("Movimiento inválido");
 await serializarEscrituraFuente(usuarioId,session);
 const existe=await Evento.exists({usuarioId:String(usuarioId),movimientoId:String(movimientoId)}).session(session);
 if(existe)throw Object.assign(new Error("Movimiento con compensaciones: modificación heredada bloqueada"),{statusCode:409});
}
module.exports={serializarEscrituraFuente,exigirOriginalSinCompensaciones};
