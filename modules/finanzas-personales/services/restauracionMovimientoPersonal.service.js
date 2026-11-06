"use strict";
const Tx=require("../models/TransaccionPersonal");
const mongoose=require("mongoose");
const {crearAplicador}=require("./compensarMovimientoPersonal.service");
const compromisos=require("./compromisosCuotas.service");
const {originalDesdeFuente}=require("./eventoCompensatorioPersonal.service");
const prestamos=require("./reversionCuotaCreditoPersonal.service");
function crearRestauradorMovimiento({TransaccionModelo=Tx,restaurarCuota=compromisos.restaurar,restaurarPrestamo=prestamos.restaurar,restaurarCaja=crearAplicador()}={}){
 return async datos=>{
  if(datos.tipo!=="RESTAURACION"||!mongoose.isObjectIdOrHexString(datos.usuarioId)||!mongoose.isObjectIdOrHexString(datos.movimientoId))
   throw Object.assign(new Error("Usuario y movimiento válidos obligatorios"),{statusCode:400});
  const fuente=await TransaccionModelo.findOne({_id:datos.movimientoId,usuarioId:datos.usuarioId}).maxTimeMS(5000).lean();
  if(!fuente)throw Object.assign(new Error("Movimiento no disponible"),{statusCode:404});
  if(fuente.tipo==="PAGO_DEUDA"){
   if(fuente.prestamoId){
    try{originalDesdeFuente(fuente);}catch{throw Object.assign(new Error("Pago de préstamo no verificable"),{statusCode:409});}
    const r=await restaurarPrestamo(datos.usuarioId,String(fuente.prestamoId),{movimientoId:datos.movimientoId,
     idempotencyKey:datos.idempotencyKey,anulacionHash:datos.anulacionHash});
    return r.compensacion;
   }
   const m=/^Compromiso ([a-f0-9]{24}) cuota ([1-9][0-9]{0,2})$/.exec(fuente.descripcion||"");
   if(!m||fuente.prestamoId||Number(m[2])>360)throw Object.assign(new Error("Este pago requiere su flujo específico de recuperación"),{statusCode:409});
   // La identidad del compromiso se obtiene de la fuente, nunca del cuerpo.
   // El servicio vuelve a comprobar fuente, anulación y cuota dentro del snapshot.
   const r=await restaurarCuota(datos.usuarioId,{compromisoId:m[1],numero:Number(m[2]),movimientoId:datos.movimientoId,
    idempotencyKey:datos.idempotencyKey,anulacionHash:datos.anulacionHash});
   return r.compensacion;
  }
  return restaurarCaja(datos);
 };
}
module.exports={crearRestauradorMovimiento,restaurarMovimiento:crearRestauradorMovimiento()};
