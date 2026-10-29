"use strict";

// Límite de validaciones simultáneas en este proceso. Si la capacidad se
// agota, denegar nuevas comprobaciones (fail closed), nunca dejar una cola
// de sockets autorizados esperando indefinidamente.
function crearLimiteValidaciones({maxConcurrent=64}={}){
 if(!Number.isInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>4096)
  throw Error("Límite de sesiones concurrentes inválido");
 let activas=0,rechazadas=0,maxObservado=0;
 async function ejecutar(verificar){
  if(typeof verificar!=="function")throw TypeError("Verificación requerida");
  if(activas>=maxConcurrent){rechazadas++;return null;}
  activas++;
  maxObservado=Math.max(maxObservado,activas);
  try{return await verificar();}
  finally{activas--;}
 }
 return Object.freeze({
  ejecutar,
  estadisticas:()=>Object.freeze({activas,rechazadas,maxObservado,maxConcurrent})
 });
}
const limiteGlobal=crearLimiteValidaciones();
module.exports={crearLimiteValidaciones,limiteGlobal};
