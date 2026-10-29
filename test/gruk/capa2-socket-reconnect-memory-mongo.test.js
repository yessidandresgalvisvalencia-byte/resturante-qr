"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const mongoose=require("mongoose");
const jwt=require("jsonwebtoken");
const {randomUUID}=require("node:crypto");
const {Server}=require("socket.io");
const WebSocket=require("ws");
const Usuario=require("../../models/usuario");
const Sede=require("../../models/sede");
const Restaurante=require("../../models/restaurante");
const {autenticarSocket}=require("../../core/auth/socketHandshake.service");
const {vigilarSesionSocket}=require("../../core/auth/socketSessionWatchdog.service");
const {crearLimiteValidaciones}=require("../../core/auth/socketValidationLimiter.service");
const {crearVerificadorCompartido}=require("../../core/auth/socketSharedVerifier.service");
const mongo=process.env.GRUK_TEST_MONGO_URI||process.env.TEST_MONGO_URI;
const ciclos=8,socketsPorCiclo=24;

function local(uri){
 try{
  const u=new URL(uri);
  return u.protocol==="mongodb:"&&!u.username&&!u.password&&
   ["localhost","127.0.0.1"].includes(u.hostname)&&(!u.port||u.port==="27017");
 }catch{return false;}
}
async function esperar(check,ms=7000){
 const fin=Date.now()+ms;
 while(Date.now()<fin){
  if(check())return;
  await new Promise(resolve=>setTimeout(resolve,25));
 }
 assert.fail("No se alcanzó el estado esperado de Socket.IO");
}
async function conectar(url,token){
 const ws=new WebSocket(url);
 try{
  await new Promise((resolve,reject)=>{
   let listo=false;
   const plazo=setTimeout(()=>terminar(Error("Timeout de handshake")),7000);
   function terminar(err){
    if(listo)return;
    listo=true;clearTimeout(plazo);
    if(err)reject(err);else resolve();
   }
   ws.on("error",terminar);
   ws.on("close",()=>terminar(Error("Socket cerrado en handshake")));
   ws.on("message",raw=>{
    const frame=raw.toString();
    if(frame.startsWith("0"))ws.send("40"+JSON.stringify({token}));
    else if(frame==="2")ws.send("3");
    else if(frame.startsWith("40{"))terminar();
    else if(frame.startsWith("44{"))terminar(Error("Handshake no autorizado"));
   });
  });
  return ws;
 }catch(err){ws.terminate();throw err;}
}
test("Capa 2: ocho ciclos de 24 WebSockets reales liberan todos los sockets y validaciones",{
 skip:!mongo&&!process.env.CI,timeout:65000
},async()=>{
 assert.ok(local(mongo),"Solo se permite MongoDB local de pruebas");
 const dbName="gruk_socket_ci_"+randomUUID().replace(/-/g,"");
 const empresaId="507f1f77bcf86cd799439011";
 const sedeId="507f191e810c19729de860ea";
 const secret="gruk-capa2-cycles-mongo-secret-32";
 const server=http.createServer((req,res)=>{res.writeHead(404);res.end();});
 const io=new Server(server,{transports:["websocket"],pingInterval:15000,pingTimeout:6000});
 const limitador=crearLimiteValidaciones({maxConcurrent:64});
 const verificador=crearVerificadorCompartido({ttlMs:0,tiempoConsultaMs:1500});
 const sockets=new Map(),ticks=new Map();
 let conectado=false,clientes=[];
 io.use(async(socket,next)=>{
  const auth=await autenticarSocket({token:socket.handshake.auth?.token,secret});
  if(!auth)return next(Error("UNAUTHORIZED"));
  socket.auth=auth;next();
 });
 io.on("connection",socket=>{
  sockets.set(socket.id,socket);
  socket.join("empresa-"+socket.auth.empresaId);
  socket.once("disconnect",()=>sockets.delete(socket.id));
  vigilarSesionSocket(socket,{
   secret,intervalMs:5000,timeoutMs:2500,limite:limitador,
   autenticar:verificador.autenticar,
   programar:fn=>{ticks.set(socket.id,fn);return 1;},
   cancelar:()=>ticks.delete(socket.id)
  });
 });
 try{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  await mongoose.connect(mongo,{dbName,serverSelectionTimeoutMS:15000});
  conectado=true;
  await Restaurante.create({
   restaurantId:"cycle-stress",empresaId,nombreRestaurante:"Cycle test",
   correo:"cycles@example.test",usuarioAdmin:"cycle",passwordAdmin:"test"
  });
  await Sede.create({
   _id:sedeId,empresaId,restauranteId:"cycle-stress",
   nombreSede:"Sede test",codigoSede:"cycles-"+randomUUID()
  });
  const user=await Usuario.create({
   empresaId,restauranteId:"cycle-stress",sedeId,nombre:"Usuario ciclos",
   usuario:"cycles-"+randomUUID(),password:"test",rol:"mesero",estado:"activo"
  });
  const token=jwt.sign({
   sub:String(user._id),empresaId,restaurantId:"cycle-stress",
   sedeId,rol:"EMPLEADO",identityType:"USUARIO",tokenVersion:0
  },secret,{algorithm:"HS256",expiresIn:"5m"});
  const url="ws://127.0.0.1:"+server.address().port+
   "/socket.io/?EIO=4&transport=websocket";
  const memoria=[];
  for(let ciclo=1;ciclo<=ciclos;ciclo++){
   const lote=[];
   for(let i=0;i<socketsPorCiclo;i+=8){
    lote.push(...await Promise.all(Array.from({length:8},()=>conectar(url,token))));
   }
   clientes=lote;
   await esperar(()=>sockets.size===socketsPorCiclo&&ticks.size===socketsPorCiclo);
   assert.equal(io.sockets.adapter.rooms.get("empresa-"+empresaId)?.size,socketsPorCiclo);
   await Promise.all([...ticks.values()].map(fn=>fn()));
   assert.equal(limitador.estadisticas().activas,0);
   assert.equal(sockets.size,socketsPorCiclo);
   const cerrados=lote.map(ws=>new Promise(resolve=>{
    if(ws.readyState===WebSocket.CLOSED)return resolve();
    ws.once("close",resolve);
    ws.close();
   }));
   await Promise.race([
    Promise.all(cerrados),
    new Promise((_,reject)=>setTimeout(()=>reject(Error("WebSockets no se cerraron")),5000))
   ]);
   await esperar(()=>sockets.size===0&&ticks.size===0);
   assert.equal(limitador.estadisticas().activas,0);
   assert.equal(io.sockets.adapter.rooms.has("empresa-"+empresaId),false);
   const m=process.memoryUsage();
   memoria.push({ciclo,rssBytes:m.rss,heapUsedBytes:m.heapUsed,
    sockets:io.engine.clientsCount,verificacionesActivas:limitador.estadisticas().activas});
   assert.equal(io.engine.clientsCount,0);
   clientes=[];
  }
  // La muestra es del runner CI, que puede tener GC y allocator variables.
  // Detecta crecimiento descontrolado, no exige RSS monótono decreciente.
  const rssInicialBytes=memoria[0].rssBytes;
  const rssFinalBytes=memoria.at(-1).rssBytes;
  const crecimientoRssBytes=rssFinalBytes-rssInicialBytes;
  assert.ok(crecimientoRssBytes<128*1024*1024,
   "Ciclos reales superaron umbral amplio de 128 MiB RSS");
  assert.equal(limitador.estadisticas().rechazadas,0);
  assert.equal(verificador.estadisticas().entradas,0);
  console.log("[GRUK CI SOCKET RECONNECT MEMORY]",JSON.stringify({
   ciclos,socketsPorCiclo,conexionesTotales:ciclos*socketsPorCiclo,
   rssInicialBytes,rssFinalBytes,crecimientoRssBytes,
   rssPorCicloBytes:memoria.map(x=>x.rssBytes),
   conexionesFinales:io.engine.clientsCount,
   verificacionesFinales:limitador.estadisticas().activas,
   entradasCacheFinales:verificador.estadisticas().entradas,
   nota:"RSS de proceso CI sin GC forzado; umbral de alarma, no SLA"
  }));
 }finally{
  for(const ws of clientes)ws.terminate();
  for(const socket of sockets.values())socket.disconnect(true);
  await new Promise(resolve=>io.close(resolve));
  if(conectado){await mongoose.connection.dropDatabase();await mongoose.disconnect();}
 }
});
