"use strict";
const {autenticarSocket}=require("./socketHandshake.service");
const {limiteGlobal}=require("./socketValidationLimiter.service");
const {verificadorCompartido}=require("./socketSharedVerifier.service");

// Cada conexión abierta se vuelve a autenticar; una revocación corta el canal.
async function comprobarSocketVigente(socket,{secret,signal,autenticar=autenticarSocket}={}){
 if(!socket.connected)return false;
 const actual=await autenticar({token:socket.handshake.auth?.token,secret,signal});
 if(!socket.connected)return false;
 if(!actual || !socket.auth ||
    actual.usuarioId!==socket.auth.usuarioId ||
    actual.empresaId!==socket.auth.empresaId ||
    actual.sedeId!==socket.auth.sedeId ||
    actual.rol!==socket.auth.rol ||
    actual.identityType!==socket.auth.identityType ||
    actual.tokenVersion!==socket.auth.tokenVersion){
  socket.disconnect(true);
  return false;
 }
 return true;
}
function vigilarSesionSocket(socket,{
 secret,intervalMs=5000,timeoutMs=2000,
 autenticar=verificadorCompartido.autenticar,
 programar=setInterval,cancelar=clearInterval,
 programarTimeout=setTimeout,cancelarTimeout=clearTimeout,
 limite=limiteGlobal
}={}){
 if(!Number.isInteger(intervalMs)||intervalMs<1000)throw Error("Intervalo inválido");
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>=intervalMs)
  throw Error("Tiempo máximo de validación inválido");
 let cerrado=false;
 let comprobando=false;
 const detener=()=>{
  if(cerrado)return;
  cerrado=true;
  cancelar(timer);
 };
 const timer=programar(async()=>{
  if(cerrado||comprobando)return;
  comprobando=true;
  let deadline;
  const controlador=new AbortController();
  try{
   const vigente=await Promise.race([
    limite.ejecutar(()=>comprobarSocketVigente(socket,{secret,autenticar,signal:controlador.signal})),
    new Promise((_,reject)=>{
     deadline=programarTimeout(()=>{
      controlador.abort();
      reject(Error("SESSION_VALIDATION_TIMEOUT"));
     },timeoutMs);
     if(typeof deadline?.unref==="function")deadline.unref();
    })
   ]);
   if(!vigente){
    if(socket.connected)socket.disconnect(true);
    detener();
   }
  }catch{
   controlador.abort();
   // Mongo lento/caído o timeout: no mantener acceso empresarial abierto.
   if(socket.connected)socket.disconnect(true);
   detener();
  }finally{
   if(deadline!==undefined)cancelarTimeout(deadline);
   comprobando=false;
  }
 },intervalMs);
 if(typeof timer?.unref==="function")timer.unref();
 socket.once("disconnect",detener);
 return detener;
}
module.exports={comprobarSocketVigente,vigilarSesionSocket};
