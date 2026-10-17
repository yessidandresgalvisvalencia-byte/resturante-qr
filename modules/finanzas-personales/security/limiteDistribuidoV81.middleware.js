"use strict";
// Adaptador para contador atómico distribuido (p. ej., Redis INCR + TTL).
// La implementación real debe garantizar incremento y expiración atómicos.
// Nunca recurre al contador local cuando falla el almacén distribuido.
function crearLimiteDistribuidoV81({incrementar,limite=20,ventanaSegundos=60,timeoutMs=2000}={}){
 if(typeof incrementar!=="function"||!Number.isSafeInteger(limite)||limite<1||
    !Number.isSafeInteger(ventanaSegundos)||ventanaSegundos<1||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)
  throw new TypeError("Configuración distribuida inválida");
 return async function limiteDistribuidoV81(req,res,next){
  const p=req.personalAuth;
  if(!p||p.verificado!==true||typeof p.userId!=="string"||!/^[a-f0-9]{24}$/i.test(p.userId))
   return res.status(401).json({ok:false,error:"Autenticación requerida"});
  try{
   // Identificador derivado exclusivamente del JWT personal previamente verificado.
   const resultado=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("Timeout Redis")),timeoutMs);
    Promise.resolve().then(()=>incrementar("fin:v81:write:"+p.userId.toLowerCase(),ventanaSegundos))
     .then(valor=>{clearTimeout(timer);resolve(valor);},error=>{clearTimeout(timer);reject(error);});
   });
   if(!resultado||!Number.isSafeInteger(resultado.cantidad)||resultado.cantidad<1||
      !Number.isSafeInteger(resultado.restanteSegundos)||resultado.restanteSegundos<1||
      resultado.restanteSegundos>ventanaSegundos)
    throw new Error("Respuesta del almacén distribuido inválida");
   if(resultado.cantidad>limite){
    res.setHeader("Retry-After",String(resultado.restanteSegundos));
    return res.status(429).json({ok:false,error:"Demasiados movimientos. Intenta más tarde."});
   }
  }catch(_){
   return res.status(503).json({ok:false,error:"Control de tráfico temporalmente no disponible"});
  }
  return next();
 };
}
module.exports={crearLimiteDistribuidoV81};
