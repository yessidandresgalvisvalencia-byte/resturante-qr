"use strict";
const {autenticarSocket}=require("./socketHandshake.service");

// Cada conexión abierta se vuelve a autenticar; una revocación corta el canal.
async function comprobarSocketVigente(socket,{secret,autenticar=autenticarSocket}={}){
 if(!socket.connected)return false;
 const actual=await autenticar({token:socket.handshake.auth?.token,secret});
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
 secret,intervalMs=5000,autenticar=autenticarSocket,
 programar=setInterval,cancelar=clearInterval
}={}){
 if(!Number.isInteger(intervalMs)||intervalMs<1000)throw Error("Intervalo inválido");
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
  try{
   if(!(await comprobarSocketVigente(socket,{secret,autenticar})))detener();
  }catch{
   // Fallar cerrado ante errores de base de datos o control de sesión.
   if(socket.connected)socket.disconnect(true);
   detener();
  }finally{comprobando=false;}
 },intervalMs);
 if(typeof timer?.unref==="function")timer.unref();
 socket.once("disconnect",detener);
 return detener;
}
module.exports={comprobarSocketVigente,vigilarSesionSocket};
