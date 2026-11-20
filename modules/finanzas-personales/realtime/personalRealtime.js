"use strict";
const {verifyPersonalToken}=require("../security/personalToken.service");
const Suscripcion=require("../models/suscripcion.model");
const {personalEventBus,PERSONAL_EVENTS}=require("../events/eventBusPersonal");
const {procesarUnaVez}=require("../events/idempotentConsumer");
function registerPersonalRealtime(io){
 const nsp=io.of("/finanzas-personales"),sesiones=new WeakMap(),porUsuario=new Map(),oyentes=[];let cerrado=false;
 async function autorizar(raw){
  const p=await verifyPersonalToken(raw),userId=String(p.sub),tokenVersion=Number(p.tokenVersion),vence=Number(p.exp)*1000;
  if(!/^[a-f0-9]{24}$/i.test(userId)||!Number.isSafeInteger(tokenVersion)||tokenVersion<1||!Number.isSafeInteger(vence)||vence<=Date.now())throw Error("UNAUTHORIZED");
  const s=await Suscripcion.findOne({userId,estado:{$in:["ACTIVA","PRUEBA"]},$or:[{vigenteHasta:null},{vigenteHasta:{$gt:new Date()}}]}).select("_id").maxTimeMS(5000).lean();
  if(!s)throw Error("PAYMENT_REQUIRED");if(vence<=Date.now())throw Error("UNAUTHORIZED");return{userId,tokenVersion,vence};
 }
 function retirar(socket){const s=sesiones.get(socket);if(s?.timer)clearTimeout(s.timer);if(s){const grupo=porUsuario.get(s.userId);grupo?.delete(socket);if(grupo?.size===0)porUsuario.delete(s.userId);}sesiones.delete(socket);}
 function desconectar(socket){retirar(socket);socket.disconnect();}
 function armarVencimiento(socket,s){
  if(cerrado||!socket.connected||sesiones.get(socket)!==s)return;
  const restante=s.vence-Date.now();if(restante<=0){desconectar(socket);return;}
  // JWT persistentes pueden superar el máximo de setTimeout; rearmar sin overflow.
  s.timer=setTimeout(()=>armarVencimiento(socket,s),Math.min(restante,2147483647));s.timer.unref?.();
 }
 nsp.use(async(socket,next)=>{try{
  const raw=String(socket.handshake.auth?.token||"").replace(/^Bearer\s+/i,"");if(!raw||cerrado)throw Error("UNAUTHORIZED");
  const actual=await autorizar(raw);if(cerrado)throw Error("UNAUTHORIZED");
  sesiones.set(socket,{raw,...actual,timer:null});socket.personalAuth=Object.freeze({userId:actual.userId,tokenVersion:actual.tokenVersion});return next();
 }catch(e){return next(new Error(e.message==="PAYMENT_REQUIRED"?"PAYMENT_REQUIRED":"UNAUTHORIZED"));}});
 nsp.on("connection",socket=>{
  const s=sesiones.get(socket);if(!s||cerrado){socket.disconnect();return;}
  socket.on("disconnect",()=>retirar(socket));if(!porUsuario.has(s.userId))porUsuario.set(s.userId,new Set());porUsuario.get(s.userId).add(socket);socket.join("personal-"+s.userId);armarVencimiento(socket,s);
 });
 for(const name of Object.values(PERSONAL_EVENTS)){
  const forward=event=>{
   if(cerrado)return;
   const usuario=String(event?.usuarioId||"");if(!/^[a-f0-9]{24}$/i.test(usuario))return;
   void procesarUnaVez({consumidor:"SOCKET_REALTIME",event},async e=>{
    // Revisar cada destinatario, sin broadcast de sala ni permisos cacheados entre eventos.
    const comprobaciones=new Map(),destinos=[...(porUsuario.get(usuario)||[])];
    await Promise.all(destinos.map(async socket=>{
     const s=sesiones.get(socket);if(!s||!socket.connected)return;
     try{
      if(!comprobaciones.has(s.raw))comprobaciones.set(s.raw,autorizar(s.raw));
      const actual=await comprobaciones.get(s.raw);
      if(cerrado||!socket.connected||sesiones.get(socket)!==s)return;
      if(actual.userId!==s.userId||actual.tokenVersion!==s.tokenVersion||s.vence<=Date.now())throw Error("UNAUTHORIZED");
      socket.emit("finanzas:evento",{eventId:e.eventId,eventName:name,occurredAt:e.occurredAt,payload:e.payload});
     }catch{if(sesiones.get(socket)===s)desconectar(socket);}
    }));
   }).catch(()=>console.error("[FIN_PERSONAL_REALTIME_EVENT] No se pudo confirmar entrega del aviso personal"));
  };
  personalEventBus.on(name,forward);oyentes.push([name,forward]);
 }
 function limpiar(){if(cerrado)return;cerrado=true;for(const [name,forward] of oyentes)personalEventBus.removeListener(name,forward);for(const socket of nsp.sockets.values())desconectar(socket);porUsuario.clear();io.httpServer?.removeListener?.("close",limpiar);}
 io.httpServer?.once?.("close",limpiar);return limpiar;
}
module.exports={registerPersonalRealtime};
