"use strict";
const {crearLimiteMovimientosV81}=require("./limiteMovimientosV81.middleware");
const {crearLimiteDistribuidoV81}=require("./limiteDistribuidoV81.middleware");
const {crearIncrementadorRedisV81}=require("./contadorRedisV81.service");
// Modo distribuido obligatorio cuando está explícitamente configurado.
// El cliente Redis debe ser suministrado por la infraestructura de la aplicación.
function crearLimiteSeleccionadoV81({modo=process.env.GRUK_V81_RATE_LIMIT_MODE,clienteRedis,local}={}){
 if(modo!==undefined&&modo!=="local"&&modo!=="redis")throw new TypeError("Modo de limitación V81 inválido");
 if(modo==="redis"){
  if(!clienteRedis||typeof clienteRedis.eval!=="function")
   return (_req,res)=>res.status(503).json({ok:false,error:"Control de tráfico distribuido no disponible"});
  return crearLimiteDistribuidoV81({incrementar:crearIncrementadorRedisV81(clienteRedis)});
 }
 return local||crearLimiteMovimientosV81();
}
module.exports={crearLimiteSeleccionadoV81};
