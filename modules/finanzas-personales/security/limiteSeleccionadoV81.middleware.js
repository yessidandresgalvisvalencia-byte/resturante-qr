"use strict";
const {crearLimiteMovimientosV81}=require("./limiteMovimientosV81.middleware");
const {crearLimiteDistribuidoV81}=require("./limiteDistribuidoV81.middleware");
const {crearIncrementadorRedisV81}=require("./contadorRedisV81.service");
// Modo distribuido obligatorio cuando está explícitamente configurado.
// El cliente Redis debe ser suministrado por la infraestructura de la aplicación.
function crearLimiteSeleccionadoV81({modo=process.env.GRUK_V81_RATE_LIMIT_MODE,clienteRedis,local}={}){
 if(modo!==undefined&&modo!=="local"&&modo!=="redis")throw new TypeError("Modo de limitación V81 inválido");
 // En producción no se permite la variante en memoria: cada nodo tendría su propia cuota.
 if(process.env.NODE_ENV==="production"&&modo!=="redis"){
  return (_req,res)=>res.status(503).json({ok:false,error:"Control distribuido de movimientos V81 requerido"});
 }
 if(modo==="redis"){
  // Se resuelve por solicitud, después de que el arranque inyecte req.app.locals.redisV81.
  // Nunca aceptar cliente Redis ni modo desde el cuerpo o cabeceras HTTP.
  return (req,res,next)=>{
   const cliente=clienteRedis||req.app?.locals?.redisV81;
   if(!cliente||typeof cliente.eval!=="function")
    return res.status(503).json({ok:false,error:"Control de tráfico distribuido no disponible"});
   try {
    return crearLimiteDistribuidoV81({incrementar:crearIncrementadorRedisV81(cliente)})(req,res,next);
   }catch(_){
    return res.status(503).json({ok:false,error:"Control de tráfico distribuido no disponible"});
   }
  };
 }
 return local||crearLimiteMovimientosV81();
}
module.exports={crearLimiteSeleccionadoV81};
