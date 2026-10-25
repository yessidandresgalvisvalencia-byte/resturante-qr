"use strict";
const Evento=require("../models/EventoCompensatorioPersonal");
const Cursor=require("../models/CursorCompensacionPersonal");
const GENESIS="0".repeat(64);
function conflicto(){
 return Object.assign(new Error("Movimiento protegido por ledger compensatorio; operación heredada bloqueada"),{statusCode:409});
}
// Fence ACID por usuario: el registrador compensatorio hace CAS sobre el MISMO
// cursor. Si ambas transacciones se superponen, MongoDB aborta una escritura.
// La revisión no es evento contable y jamás altera hashActual ni secuencia.
async function exigirSinCompensacionesHeredadas({
 usuarioId,movimientoId,session,EventoModelo=Evento,CursorModelo=Cursor
}){
 if(!session||!usuarioId||!movimientoId)throw conflicto();
 const uid=String(usuarioId),mid=String(movimientoId);
 try{
  const existente=await EventoModelo.findOne({usuarioId:uid,movimientoId:mid})
   .session(session).lean();
  if(existente)throw conflicto();
  const cursor=await CursorModelo.findById(uid).session(session).lean();
  if(!cursor){
   await CursorModelo.create([{_id:uid,secuencia:0,hashActual:GENESIS,
    revisionLegada:0}],{session});
  }else if(!Number.isSafeInteger(cursor.secuencia)||cursor.secuencia<0||
   typeof cursor.hashActual!=="string"||!/^[a-f0-9]{64}$/.test(cursor.hashActual)||
   (cursor.revisionLegada!=null&&
    (!Number.isSafeInteger(cursor.revisionLegada)||cursor.revisionLegada<0))||
   (cursor.revisionLegada??0)>=Number.MAX_SAFE_INTEGER)
   throw conflicto();
  const actualizado=await CursorModelo.findOneAndUpdate({
   _id:uid
  },{$inc:{revisionLegada:1}},{session,new:true,runValidators:true});
  if(!actualizado)throw conflicto();
  // El segundo chequeo evita dar paso a un asiento compensado visible
  // por cualquier lógica futura que cambie el orden de las consultas.
  const posterior=await EventoModelo.findOne({usuarioId:uid,movimientoId:mid})
   .session(session).lean();
  if(posterior)throw conflicto();
  return true;
 }catch(error){
  if(error?.statusCode)throw error;
  if(error?.code===11000||[112,251].includes(error?.code)||
   error?.hasErrorLabel?.("TransientTransactionError"))
   throw Object.assign(new Error("Mutación concurrente del ledger; reintenta con la misma solicitud"),
    {statusCode:409});
  throw Object.assign(new Error("No se pudo verificar el ledger compensatorio de forma atómica"),
   {statusCode:503});
 }
}
module.exports={exigirSinCompensacionesHeredadas};
