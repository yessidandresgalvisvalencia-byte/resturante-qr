"use strict";
const crypto=require("node:crypto");
// Límite por usuario autenticado (un solo proceso). No sustituye Redis/WAF en horizontal.
function crearLimiteConfirmacionHistoricaV81({max=20,windowMs=60_000,reloj=Date.now}={}){
 if(!Number.isSafeInteger(max)||max<1||!Number.isSafeInteger(windowMs)||windowMs<1000)
  throw new TypeError("Configuración de límite inválida");
 const buckets=new Map();
 return(req,res,next)=>{
  const id=req.personalAuth?.verificado===true?req.personalAuth?.userId:null;
  const secret=process.env.PERSONAL_RATE_LIMIT_SECRET||process.env.PERSONAL_JWT_SECRET;
  if(typeof id!=="string"||!/^[a-f0-9]{24}$/i.test(id)||!secret)
   return res.status(503).json({ok:false,error:"Protección de confirmación no disponible"});
  const key=crypto.createHmac("sha256",secret).update("vinculo-historico:"+id).digest("hex");
  const now=reloj();
  let entry=buckets.get(key);
  if(!entry||now-entry.start>=windowMs)entry={start:now,count:0};
  entry.count++;
  buckets.set(key,entry);
  if(buckets.size>20_000)for(const [k,v] of buckets)if(now-v.start>=windowMs)buckets.delete(k);
  if(entry.count>max){
   res.setHeader("Retry-After",String(Math.max(1,Math.ceil((entry.start+windowMs-now)/1000))));
   return res.status(429).json({ok:false,error:"Demasiadas confirmaciones. Intenta más tarde."});
  }
  return next();
 };
}
module.exports={crearLimiteConfirmacionHistoricaV81};
