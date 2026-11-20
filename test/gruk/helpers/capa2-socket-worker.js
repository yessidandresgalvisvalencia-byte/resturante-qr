"use strict";
// Proceso aislado para pruebas CI. Nunca aceptar URI de producción.
const http=require("node:http");
const mongoose=require("mongoose");
const {Server}=require("socket.io");
const {autenticarSocket}=require("../../../core/auth/socketHandshake.service");
const {vigilarSesionSocket}=require("../../../core/auth/socketSessionWatchdog.service");
const {limiteGlobal}=require("../../../core/auth/socketValidationLimiter.service");
const {verificadorCompartido}=require("../../../core/auth/socketSharedVerifier.service");

const uri=process.env.GRUK_WORKER_MONGO_URI;
const dbName=process.env.GRUK_WORKER_DB;
const secret=process.env.GRUK_WORKER_SECRET;
const proceso=process.env.GRUK_WORKER_NAME;
const parsed=(()=>{try{return new URL(uri);}catch{return null;}})();
if(!parsed||parsed.protocol!=="mongodb:"||
   !["127.0.0.1","localhost"].includes(parsed.hostname)||
   parsed.username||parsed.password||!dbName?.startsWith("gruk_socket_process_ci_")||
   !secret||!["uno","dos"].includes(proceso))process.exit(12);

const server=http.createServer((req,res)=>{res.writeHead(404);res.end();});
const io=new Server(server,{transports:["websocket"],pingInterval:15000,pingTimeout:6000});
const sockets=new Map();
io.use(async(socket,next)=>{
 const auth=await autenticarSocket({token:socket.handshake.auth?.token,secret});
 if(!auth)return next(new Error("UNAUTHORIZED"));
 socket.auth=auth;
 next();
});
io.on("connection",socket=>{
 sockets.set(socket.id,socket);
 socket.join("empresa-"+socket.auth.empresaId);
 vigilarSesionSocket(socket,{secret,intervalMs:1000,timeoutMs:500});
 socket.once("disconnect",()=>{
  process.send?.({tipo:"desconectado",proceso,usuarioId:socket.auth.usuarioId});
  sockets.delete(socket.id);
 });
});
let cerrando=false;
async function cerrar(){
 if(cerrando)return;
 cerrando=true;
 for(const socket of sockets.values())socket.disconnect(true);
 await new Promise(resolve=>io.close(resolve));
 await mongoose.disconnect();
 process.exit(0);
}
process.on("message",msg=>{
 if(msg?.tipo==="detener")cerrar().catch(()=>process.exit(1));
 if(msg?.tipo==="estado"){
  process.send?.({tipo:"estado",proceso,
   salas:Object.fromEntries([...io.sockets.adapter.rooms].filter(([k])=>k.startsWith("empresa-")).map(([k,v])=>[k,v.size])),
   validaciones:verificadorCompartido.estadisticas(),
   limite:limiteGlobal.estadisticas()});
 }
});
(async()=>{
 await mongoose.connect(uri,{dbName,serverSelectionTimeoutMS:10000});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 process.send?.({tipo:"listo",proceso,puerto:server.address().port});
})().catch(error=>{
 process.send?.({tipo:"fallo",proceso,error:error.message});
 process.exit(1);
});
