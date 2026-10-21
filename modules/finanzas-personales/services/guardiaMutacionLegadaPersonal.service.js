"use strict";
const Evento=require("../models/EventoCompensatorioPersonal");
function conflicto(){
 return Object.assign(new Error("Movimiento protegido por ledger compensatorio; operación heredada bloqueada"),{statusCode:409});
}
// Debe ejecutarse dentro de la misma sesión transaccional y ANTES de
// modificar saldos, reservas, el asiento original u outbox.
async function exigirSinCompensacionesHeredadas({
 usuarioId,movimientoId,session,EventoModelo=Evento
}){
 if(!session||!usuarioId||!movimientoId)throw conflicto();
 let evento;
 try{
  evento=await EventoModelo.findOne({
   usuarioId:String(usuarioId),movimientoId:String(movimientoId)
  }).session(session).lean();
 }catch(error){
  if(error.statusCode)throw error;
  throw Object.assign(new Error("No se pudo comprobar el ledger compensatorio"),{statusCode:503});
 }
 if(evento)throw conflicto();
 return true;
}
module.exports={exigirSinCompensacionesHeredadas};
