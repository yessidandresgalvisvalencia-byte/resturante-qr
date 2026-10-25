"use strict";
// Construcción pura del evento de reconciliación. El llamador deberá
// reauditar, hacer CAS y grabar ESTE evento en una sola transacción.
// No confundir hash sin clave con firma ni con cadena completa.
const crypto=require("node:crypto");
const HEX=/^[a-f0-9]{64}$/;
const MONEY=/^(0|[1-9][0-9]*)$/;
const ID=/^[a-f0-9]{24}$/i;
function fallo(m,statusCode=409){
 throw Object.assign(new Error("EVENTO_RECONCILIACION: "+m),{statusCode});
}
function convertirFecha(d){
 if(!(d instanceof Date)||!Number.isFinite(d.getTime()))
  fallo("fecha inválida",400);
 return d.toISOString();
}
function construirEventoReconciliacionReserva({
 usuarioId,origenId,reservaId,periodoInicio,huellaEstadoPrevio,
 huellaDiagnostico,idempotencyHash,importeAnteriorMinor,
 importeNuevoMinor,fecha
}){
 for(const id of [usuarioId,origenId,reservaId])
  if(typeof id!=="string"||!ID.test(id))fallo("identidad inválida",400);
 for(const hash of [huellaEstadoPrevio,huellaDiagnostico,idempotencyHash])
  if(typeof hash!=="string"||!HEX.test(hash))
   fallo("huella inválida",400);
 if(!MONEY.test(importeAnteriorMinor)||!MONEY.test(importeNuevoMinor))
  fallo("importe debe ser cadena decimal entera no negativa",400);
 const previo=BigInt(importeAnteriorMinor),nuevo=BigInt(importeNuevoMinor);
 if(previo>BigInt(Number.MAX_SAFE_INTEGER)||
    nuevo>BigInt(Number.MAX_SAFE_INTEGER))
  fallo("importe fuera de rango seguro",400);
 if(nuevo===previo)fallo("reconciliación sin efecto");
 const inicio=convertirFecha(periodoInicio),instante=convertirFecha(fecha);
 const payload={
  version:1,tipo:"RECONCILIACION_RESERVA",
  usuarioId:usuarioId.toLowerCase(),origenId:origenId.toLowerCase(),
  reservaId:reservaId.toLowerCase(),periodoInicio:inicio,
  idempotencyHash,huellaEstadoPrevio,huellaDiagnostico,
  importeAnteriorMinor,importeNuevoMinor,
  deltaMinor:String(nuevo-previo),fecha:instante
 };
 const hashEvento=crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
 return Object.freeze({...payload,hashEvento});
}
function verificarEventoReconciliacionReserva(evento){
 if(!evento||typeof evento!=="object")return false;
 try{
  const {hashEvento,_id,...datos}=evento;
  const reconstruido=construirEventoReconciliacionReserva({
   ...datos,periodoInicio:new Date(datos.periodoInicio),
   fecha:new Date(datos.fecha)
  });
  if(Object.keys(datos).length!==Object.keys(reconstruido).length-1||
    Object.keys(datos).some(k=>!(k in reconstruido))||
    Object.keys(datos).some(k=>{
     const original=datos[k] instanceof Date?datos[k].toISOString():datos[k];
     return original!==reconstruido[k];
    })||hashEvento!==reconstruido.hashEvento)return false;
  return true;
 }catch(_){return false;}
}
module.exports={construirEventoReconciliacionReserva,
 verificarEventoReconciliacionReserva};
