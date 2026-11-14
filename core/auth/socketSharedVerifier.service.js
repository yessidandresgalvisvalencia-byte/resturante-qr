"use strict";
const {createHash}=require("node:crypto");
const {autenticarSocket}=require("./socketHandshake.service");

// Solo para REVALIDACIÓN periódica; el handshake inicial siempre verifica Mongo.
// La caché está indexada por token+secreto (hash), jamás por empresa solamente.
function crearVerificadorCompartido({
 verificar=autenticarSocket,ttlMs=350,maxEntradas=512,
 tiempoConsultaMs=1500,ahora=Date.now
}={}){
 if(!Number.isInteger(ttlMs)||ttlMs<0||ttlMs>1000 ||
    !Number.isInteger(maxEntradas)||maxEntradas<1||maxEntradas>8192 ||
    !Number.isInteger(tiempoConsultaMs)||tiempoConsultaMs<100||tiempoConsultaMs>3000)
  throw Error("Configuración inválida de revalidación compartida");
 const entradas=new Map();
 let consultas=0,compartidas=0,aciertos=0,rechazos=0;
 async function autenticar({token,secret,signal}={}){
  if(signal?.aborted||typeof token!=="string"||!secret||token.length>8192)return null;
  const clave=createHash("sha256").update(secret).update("\0").update(token).digest("hex");
  const existente=entradas.get(clave);
  if(existente && existente.hasta>ahora() && existente.resultado){
   aciertos++;
   return signal?.aborted?null:existente.resultado;
  }
  if(existente?.pendiente){
   compartidas++;
   const valor=await existente.pendiente;
   return signal?.aborted?null:valor;
  }
  if(existente)entradas.delete(clave);
  for(const [k,v] of entradas){
   if(!v.pendiente && v.hasta<=ahora())entradas.delete(k);
  }
  if(entradas.size>=maxEntradas){
   rechazos++;
   return null; // Fail closed: nunca cola ilimitada ni autorización obsoleta.
  }
  consultas++;
  const controller=new AbortController();
  const entrada={pendiente:null,hasta:0,resultado:null};
  let plazo;
  // Race real: abortar no basta si un driver/adapter ignora AbortSignal.
  // Una operación tardía jamás vuelve a poblar el caché tras vencer el plazo.
  const trabajo=Promise.resolve().then(()=>
   verificar({token,secret,signal:controller.signal})
  ).catch(()=>null);
  const vencimiento=new Promise(resolve=>{
   plazo=setTimeout(()=>{
    controller.abort();
    resolve(null);
   },tiempoConsultaMs);
   if(typeof plazo.unref==="function")plazo.unref();
  });
  const pendiente=Promise.race([trabajo,vencimiento]).then(resultado=>{
   if(!controller.signal.aborted && resultado){
    entrada.resultado=resultado;
    entrada.hasta=ahora()+ttlMs;
    return resultado;
   }
   return null;
  }).finally(()=>{
   clearTimeout(plazo);
   entrada.pendiente=null;
   if(!entrada.resultado||ttlMs===0)entradas.delete(clave);
  });
  entrada.pendiente=pendiente;
  entradas.set(clave,entrada);
  const resultado=await pendiente;
  return signal?.aborted?null:resultado;
 }
 return Object.freeze({
  autenticar,
  estadisticas:()=>Object.freeze({
   consultas,compartidas,aciertos,rechazos,entradas:entradas.size
  })
 });
}
const verificadorCompartido=crearVerificadorCompartido();
module.exports={crearVerificadorCompartido,verificadorCompartido};
