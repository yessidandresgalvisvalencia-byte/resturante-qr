"use strict";
// Per-instance counters prevent unrelated rate-limit policies sharing quotas.
// This is process-local protection, not distributed rate limiting.
function rateLimit({windowMs=60000,max=120}={}){
 if(!Number.isSafeInteger(windowMs)||windowMs<=0||!Number.isSafeInteger(max)||max<=0)throw new Error("RATE_LIMIT_CONFIG_INVALID");
 const buckets=new Map(),capacity=10000;
 return function(req,res,next){
  const now=Date.now(),key=String(req.ip||req.socket?.remoteAddress||"unknown");
  let b=buckets.get(key);
  if(b&&now-b.start>=windowMs){buckets.delete(key);b=undefined;}
  if(!b&&buckets.size>=capacity)for(const [ip,entry] of buckets)if(now-entry.start>=windowMs)buckets.delete(ip);
  if(!b&&buckets.size>=capacity){
   res.setHeader("Retry-After",String(Math.ceil(windowMs/1000)));
   return res.status(429).json({ok:false,error:"Demasiadas solicitudes"});
  }
  if(!b)b={start:now,count:0};
  b.count++;buckets.set(key,b);
  if(b.count>max){
   res.setHeader("Retry-After",String(Math.max(1,Math.ceil((b.start+windowMs-now)/1000))));
   return res.status(429).json({ok:false,error:"Demasiadas solicitudes"});
  }
  return next();
 };
}
module.exports=rateLimit;
