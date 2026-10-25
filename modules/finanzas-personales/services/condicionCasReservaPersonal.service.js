"use strict";
// Filtros CAS para un futuro ejecutor transaccional. NO escribe en Mongo:
// una propuesta de filtro nunca sustituye la reauditoría ACID.
const mongoose=require("mongoose");
function fallo(m,statusCode=409){return Object.assign(new Error("CAS_RESERVA: "+m),{statusCode});}
function oid(valor){
 if(!mongoose.isValidObjectId(valor)||!(/^[a-f0-9]{24}$/i).test(String(valor)))
  throw fallo("identificador inválido",400);
 return new mongoose.Types.ObjectId(String(valor));
}
function fecha(valor){
 if(!(valor instanceof Date)||!Number.isFinite(valor.getTime()))
  throw fallo("fecha de reserva inválida",400);
 return new Date(valor.getTime());
}
function entero(n,{positivo=false}={}){
 if(!Number.isSafeInteger(n)||(positivo?n<=0:n<0))
  throw fallo("importe de reserva inválido",400);
 return n;
}
function prepararCondicionCasReserva({usuarioId,origenId,reserva,
 importeEsperadoMinor,importeNuevoMinor}){
 if(!reserva||typeof reserva!=="object"||Array.isArray(reserva))
  throw fallo("reserva original obligatoria",400);
 const uid=oid(usuarioId),origen=oid(origenId);
 const rid=oid(reserva._id);
 if(String(reserva.usuarioId)!==String(uid)||
    String(reserva.origenId)!==String(origen))
  throw fallo("reserva ajena o de otra obligación");
 const actual=entero(reserva.reservadoMinor);
 const esperado=entero(importeEsperadoMinor);
 const nuevo=entero(importeNuevoMinor);
 const cuota=entero(reserva.importeCuotaMinor,{positivo:true});
 if(esperado!==actual||nuevo>cuota)
  throw fallo("reserva modificada o propuesta supera cuota");
 const inicio=fecha(reserva.periodoInicio),fin=fecha(reserva.periodoFin);
 if(inicio>=fin)throw fallo("período de reserva no válido");
 const filtro=Object.freeze({
  _id:rid,usuarioId:uid,origenId:origen,
  periodoInicio:inicio,periodoFin:fin,
  importeCuotaMinor:cuota,reservadoMinor:actual
 });
 return Object.freeze({
  filtro,importeNuevoMinor:nuevo,deltaMinor:String(BigInt(nuevo)-BigInt(actual)),
  updatePermitidoSoloConTransaccion:false,
  requiereResultadoMatchedExactlyOne:true,requiereEventoAppendOnly:true,
  requiereReauditoriaEnMismaTransaccion:true
 });
}
module.exports={prepararCondicionCasReserva};
