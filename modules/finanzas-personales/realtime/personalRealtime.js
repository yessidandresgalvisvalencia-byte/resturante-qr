"use strict";
const {verifyPersonalToken}=require("../security/personalToken.service");
const {personalEventBus,PERSONAL_EVENTS}=require("../events/eventBusPersonal");
function registerPersonalRealtime(io){
 const nsp=io.of("/finanzas-personales");
 nsp.use(async(socket,next)=>{try{const raw=String(socket.handshake.auth?.token||"").replace(/^Bearer\s+/i,"");if(!raw)return next(new Error("UNAUTHORIZED"));const p=await verifyPersonalToken(raw);socket.personalAuth=Object.freeze({userId:String(p.sub),tokenVersion:Number(p.tokenVersion||0)});return next();}catch(_){return next(new Error("UNAUTHORIZED"));}});
 nsp.on("connection",socket=>socket.join("personal-"+socket.personalAuth.userId));
 const forward=name=>personalEventBus.on(name,event=>nsp.to("personal-"+event.usuarioId).emit("finanzas:evento",{eventName:name,occurredAt:event.occurredAt,payload:event.payload}));
 Object.values(PERSONAL_EVENTS).forEach(forward);
}
module.exports={registerPersonalRealtime};