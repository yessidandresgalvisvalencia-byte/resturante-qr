"use strict";
// Límite defensivo por proceso: no sustituye el contador distribuido obligatorio en producción multinodo.
function crearLimiteMovimientosV81({max=20,windowMs=60000,now=Date.now}={}){
 if(!Number.isSafeInteger(max)||max<1||!Number.isSafeInteger(windowMs)||windowMs<1000||typeof now!=="function")throw new TypeError("Configuración de límite inválida");
 const buckets=new Map();
 return function limiteMovimientosV81(req,res,next){
  const principal=req.personalAuth;
  if(!principal||principal.verificado!==true||typeof principal.userId!=="string"||!/^[0-9a-f]{24}$/i.test(principal.userId)){
   return res.status(401).json({ok:false,error:"Autenticación requerida"});
  }
  const tiempo=now();
  if(!Number.isFinite(tiempo))return res.status(503).json({ok:false,error:"Control de tráfico no disponible"});
  // Las claves se extraen de identidad verificada, nunca de IP/X-Forwarded-For ni body.
  const key=principal.userId.toLowerCase();
  const prev=buckets.get(key);
  const bucket=!prev||tiempo-prev.start>=windowMs||tiempo<prev.start?{start:tiempo,count:0}:prev;
  bucket.count++;
  buckets.delete(key);
  buckets.set(key,bucket);
  if(buckets.size>10000){
   for(const [k,v] of buckets)if(tiempo-v.start>=windowMs||tiempo<v.start)buckets.delete(k);
   // No descartar cuentas activas para liberar cupos: fallar cerrado.
   if(buckets.size>10000)return res.status(503).json({ok:false,error:"Control de tráfico temporalmente saturado"});
  }
  if(bucket.count>max){
   res.setHeader("Retry-After",String(Math.max(1,Math.ceil((bucket.start+windowMs-tiempo)/1000))));
   return res.status(429).json({ok:false,error:"Demasiados movimientos. Intenta más tarde."});
  }
  return next();
 };
}
module.exports={crearLimiteMovimientosV81};
