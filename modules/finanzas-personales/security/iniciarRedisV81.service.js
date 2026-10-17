"use strict";
// Inicialización explícita por la aplicación anfitriona: no conecta ni altera GRUK Empresarial.
// El llamador crea el cliente con una URL/credenciales secretas desde su infraestructura.
async function iniciarRedisV81(app,{crearCliente,url=process.env.GRUK_V81_REDIS_URL}={}){
 if(!app||!app.locals||typeof crearCliente!=="function")throw new TypeError("Configuración Redis V81 inválida");
 // Invalidar inmediatamente cualquier cliente previo antes de una reinicialización.
 delete app.locals.redisV81;
 if(typeof url!=="string"||!url.trim())throw new Error("GRUK_V81_REDIS_URL requerido");
 let parsed;
 try{parsed=new URL(url);}catch(_){throw new Error("URL Redis V81 inválida");}
 if(!["rediss:","redis:"].includes(parsed.protocol)||!parsed.hostname)throw new Error("Protocolo Redis V81 inválido");
 if(process.env.NODE_ENV==="production"&&parsed.protocol!=="rediss:")throw new Error("En producción Redis requiere TLS (rediss)");
 let cliente;
 try{
  cliente=crearCliente({url});
  if(!cliente||typeof cliente.eval!=="function"||typeof cliente.connect!=="function")throw new TypeError("Cliente Redis incompatible");
  await cliente.connect();
  if(cliente.isReady!==true)throw new Error("Redis no confirmó estado listo");
  if(typeof cliente.ping!=="function"||await cliente.ping()!=="PONG")throw new Error("Redis no respondió a PING");
  app.locals.redisV81=cliente;
  return cliente;
 }catch(e){
  delete app.locals.redisV81;
  if(cliente&&typeof cliente.quit==="function")try{await cliente.quit();}catch(_){}
  throw e;
 }
}
module.exports={iniciarRedisV81};
