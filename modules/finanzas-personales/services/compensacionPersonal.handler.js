"use strict";
const mongoose=require("mongoose");
const {crearRegistradorFinancieroPersonal}=
 require("./registradorFinancieroPersonal.service");
const CAMPOS=["tipo","montoMinor","concepto","categoria"];
const ID=/^[A-Za-z0-9_-]{1,128}$/;
// El propietario proviene EXCLUSIVAMENTE de la sesión personal autenticada.
// El cliente informa el estado que leyó; el registrador lo coteja dentro de
// su snapshot con el original persistido y la última compensación firmada.
function crearCompensacionPersonalHandler({
 registrar=crearRegistradorFinancieroPersonal(),
 reloj=()=>new Date()
}={}){
 if(typeof registrar!=="function"||typeof reloj!=="function")
  throw new TypeError("Dependencias de compensación inválidas");
 return async function handler(req,res){
  try{
   const usuarioId=String(req.personalAuth?.userId||"");
   const movimientoId=String(req.params?.id||"");
   const input=req.validated;
   if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(movimientoId)||
      !input||!ID.test(input.idempotencyKey))
    return res.status(400).json({ok:false,error:"Identidad, movimiento o idempotencia inválidos"});
   if(!input.original||typeof input.original!=="object"||
      CAMPOS.some(c=>!Object.prototype.hasOwnProperty.call(input.original,c)))
    return res.status(400).json({ok:false,error:"Estado original completo requerido"});
   const original={usuarioId,movimientoId,
    tipo:input.original.tipo,montoMinor:input.original.montoMinor,
    concepto:input.original.concepto,categoria:input.original.categoria};
   const fecha=reloj();
   if(!(fecha instanceof Date)||!Number.isFinite(fecha.getTime()))
    throw Object.assign(new Error("Reloj de auditoría no disponible"),{statusCode:503});
   const evento=await registrar({
    original,tipo:input.tipo,cambios:input.cambios||{},
    idempotencyKey:input.idempotencyKey,fechaISO:fecha.toISOString()
   });
   return res.status(201).json({ok:true,compensacion:{
    movimientoId:evento.movimientoId,tipo:evento.tipo,
    secuencia:evento.secuencia,hashActual:evento.hashActual,
    deltaCajaMinor:evento.deltaCajaMinor
   }});
  }catch(error){
   return res.status(error?.statusCode||500).json({
    ok:false,error:error?.statusCode?error.message:"No fue posible registrar la compensación"
   });
  }
 };
}
module.exports={crearCompensacionPersonalHandler};
