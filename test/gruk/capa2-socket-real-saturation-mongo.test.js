"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const mongoose=require("mongoose");
const jwt=require("jsonwebtoken");
const WebSocket=require("ws");
const {randomUUID}=require("node:crypto");
const {Server}=require("socket.io");
const Usuario=require("../../models/usuario");
const Sede=require("../../models/sede");
const Restaurante=require("../../models/restaurante");
const {autenticarSocket}=require("../../core/auth/socketHandshake.service");
const {vigilarSesionSocket}=require("../../core/auth/socketSessionWatchdog.service");
const {crearLimiteValidaciones}=require("../../core/auth/socketValidationLimiter.service");
const {crearVerificadorCompartido}=require("../../core/auth/socketSharedVerifier.service");
const mongo=process.env.GRUK_TEST_MONGO_URI||process.env.TEST_MONGO_URI;
function local(uri){
 try{
  const u=new URL(uri);
  return u.protocol==="mongodb:"&&!u.username&&!u.password&&
   ["localhost","127.0.0.1"].includes(u.hostname)&&(!u.port||u.port==="27017");
 }catch{return false;}
}
async function esperar(fn,ms=6000){
 const limite=Date.now()+ms;
 while(Date.now()<limite){
  if(fn())return;
  await new Promise(r=>setTimeout(r,25));
 }
 assert.fail("No se alcanzó el estado de carga WebSocket esperado");
}
async function websocket(url,token,clients){
 const ws=new WebSocket(url);
 clients.push(ws);
 return new Promise((resolve,reject)=>{
  let terminado=false;
  const timeout=setTimeout(()=>fin(Error("Timeout handshake real")),7000);
  const fin=(err,msg)=>{
   if(terminado)return;
   terminado=true;clearTimeout(timeout);
   if(err)reject(err);else resolve(msg);
  };
  ws.on("error",e=>fin(e));
  ws.on("close",()=>fin(Error("Cierre durante handshake")));
  ws.on("message",raw=>{
   const msg=raw.toString();
   if(msg.startsWith("0"))ws.send("40"+JSON.stringify({token}));
   else if(msg==="2")ws.send("3");
   else if(msg.startsWith("40{")||msg.startsWith("44{"))fin(null,msg);
  });
 });
}
test("Capa 2: 96 WebSockets reales saturan 64 revalidaciones, rechazan 32 y recuperan cupos",{
 skip:!mongo&&!process.env.CI,timeout:55000
},async()=>{
 assert.ok(local(mongo),"Prueba destructiva únicamente en Mongo local CI");
 const dbName="gruk_socket_ci_"+randomUUID().replace(/-/g,"");
 const empresaId="507f1f77bcf86cd799439011";
 const sedeId="507f191e810c19729de860ea";
 const secret="gruk-capa2-real-saturacion-32-chars";
 const httpServer=http.createServer((req,res)=>{res.writeHead(404);res.end();});
 const io=new Server(httpServer,{transports:["websocket"],pingInterval:15000,pingTimeout:6000});
 const sockets=new Map(),ticks=new Map(),clients=[];
 const limitador=crearLimiteValidaciones({maxConcurrent:64});
 let dbConnected=false,liberar,onMongoCommand,mongoClient;
 const consultasPorColeccion=new Map();
 const bloqueo=new Promise(resolve=>liberar=resolve);
 let verificaciones=0,modoCompartido=false;
 // ttlMs=0: deduplicar SOLAMENTE consultas simultáneas, nunca cachear
 // resultados entre rondas; obliga a consultar Mongo en cada vuelta.
 const compartido=crearVerificadorCompartido({ttlMs:0,tiempoConsultaMs:1500});
 const autenticar=async({token,secret:clave,signal})=>{
  if(modoCompartido)return compartido.autenticar({token,secret:clave,signal});
  verificaciones++;
  await bloqueo;
  if(signal.aborted)return null;
  return autenticarSocket({token,secret:clave,signal});
 };
 io.use(async(socket,next)=>{
  const auth=await autenticarSocket({token:socket.handshake.auth?.token,secret});
  if(!auth)return next(Error("UNAUTHORIZED"));
  socket.auth=auth;next();
 });
 io.on("connection",socket=>{
  sockets.set(socket.id,socket);
  socket.join("empresa-"+socket.auth.empresaId);
  vigilarSesionSocket(socket,{
   secret,intervalMs:5000,timeoutMs:3000,limite:limitador,autenticar,
   programar:fn=>{ticks.set(socket.id,fn);return 1;},
   cancelar:()=>ticks.delete(socket.id)
  });
 });
 try{
  await new Promise(resolve=>httpServer.listen(0,"127.0.0.1",resolve));
  await mongoose.connect(mongo,{dbName,serverSelectionTimeoutMS:15000,monitorCommands:true});
  dbConnected=true;
  await Restaurante.create({
   restaurantId:"socket-stress",empresaId,nombreRestaurante:"Socket CI",
   correo:"stress@example.test",usuarioAdmin:"stress",passwordAdmin:"test"
  });
  await Sede.create({
   _id:sedeId,empresaId,restauranteId:"socket-stress",
   nombreSede:"Sede",codigoSede:"stress-"+randomUUID()
  });
  const user=await Usuario.create({
   empresaId,restauranteId:"socket-stress",sedeId,nombre:"Socket test",
   usuario:"stress-"+randomUUID(),password:"test",rol:"mesero",estado:"activo"
  });
  const token=jwt.sign({
   sub:String(user._id),empresaId,restaurantId:"socket-stress",
   sedeId,rol:"EMPLEADO",identityType:"USUARIO",tokenVersion:0
  },secret,{algorithm:"HS256",expiresIn:"5m"});
  const url="ws://127.0.0.1:"+httpServer.address().port+"/socket.io/?EIO=4&transport=websocket";
  for(let lote=0;lote<96;lote+=12){
   const resultado=await Promise.all(Array.from({length:12},()=>websocket(url,token,clients)));
   assert.equal(resultado.every(p=>p.startsWith("40{")),true);
  }
  await esperar(()=>ticks.size===96);
  assert.equal(sockets.size,96);
  const entradas=[...ticks.entries()];
  const pendientes=entradas.map(([,fn])=>fn());
  await esperar(()=>limitador.estadisticas().activas===64);
  await esperar(()=>[...sockets.values()].filter(s=>!s.connected).length===32);
  assert.equal(verificaciones,64);
  assert.equal(limitador.estadisticas().rechazadas,32);
  assert.equal(limitador.estadisticas().maxObservado,64);
  // Medir comandos de Mongo durante varias rondas de autorización, sin
  // incluir ni los 96 handshakes ni el alta de datos en esta medición.
  mongoClient=mongoose.connection.getClient();
  onMongoCommand=event=>{
   if(event.commandName!=="find")return;
   const nombre=String(event.command?.find||"desconocida");
   consultasPorColeccion.set(nombre,(consultasPorColeccion.get(nombre)||0)+1);
  };
  mongoClient.on("commandStarted",onMongoCommand);
  const inicioMedicion=Date.now();
  liberar();
  await Promise.all(pendientes);
  assert.equal(limitador.estadisticas().activas,0);
  assert.equal([...sockets.values()].filter(s=>s.connected).length,64);
  // Mantener 64 conexiones vivas y repetir tres verificaciones efectivas
  // adicionales. El watchdog reutiliza el mismo límite de concurrencia.
  const rondasAdicionales=3;
  for(let ronda=0;ronda<rondasAdicionales;ronda++){
   const activas=[...ticks.values()];
   assert.equal(activas.length,64);
   await Promise.all(activas.map(tick=>tick()));
   assert.equal(limitador.estadisticas().activas,0);
   assert.equal([...sockets.values()].filter(s=>s.connected).length,64,
    "Una conexión legítima no debe perder acceso sin revocación");
  }
  const duracionMedicionMs=Date.now()-inicioMedicion;
  mongoClient.off("commandStarted",onMongoCommand);
  onMongoCommand=null;
  const consultasMongo=[...consultasPorColeccion.values()].reduce((a,b)=>a+b,0);
  assert.ok(consultasMongo>=64*2*(rondasAdicionales+1),
   "Cada ronda real debe verificar usuario y sede en Mongo sin omitir consultas");
  assert.ok(consultasMongo<1200,
   "El estrés controlado no debe disparar consultas adicionales inesperadas");
  console.log("[GRUK CI SOCKET REAL MONGO PRESSURE]",JSON.stringify({
   socketsPersistentes:64,rondasRevalidacion:rondasAdicionales+1,
   duracionMedicionMs,consultasMongo,
   consultasPorColeccion:Object.fromEntries(consultasPorColeccion),
   maxConcurrentObserved:limitador.estadisticas().maxObservado,
   medicion:"find en Mongo local CI; no es SLA de producción"
  }));
  // Comparación A/B dentro de ESTE MISMO servidor, 64 conexiones y
  // cuatro rondas. Sólo cambia el verificador (sin TTL entre rondas).
  modoCompartido=true;
  const consultasCompartidas=new Map();
  onMongoCommand=event=>{
   if(event.commandName!=="find")return;
   const nombre=String(event.command?.find||"desconocida");
   consultasCompartidas.set(nombre,(consultasCompartidas.get(nombre)||0)+1);
  };
  mongoClient.on("commandStarted",onMongoCommand);
  const inicioCompartido=Date.now();
  const llamadasAntes=compartido.estadisticas().consultas;
  for(let ronda=0;ronda<rondasAdicionales+1;ronda++){
   assert.equal(ticks.size,64);
   await Promise.all([...ticks.values()].map(tick=>tick()));
   assert.equal(limitador.estadisticas().activas,0);
   assert.equal([...sockets.values()].filter(s=>s.connected).length,64,
    "El verificador compartido no puede desconectar sesiones válidas");
  }
  const duracionCompartidaMs=Date.now()-inicioCompartido;
  mongoClient.off("commandStarted",onMongoCommand);
  onMongoCommand=null;
  const comandosCompartidos=[...consultasCompartidas.values()].reduce((a,b)=>a+b,0);
  const verificacionesCompartidas=compartido.estadisticas().consultas-llamadasAntes;
  assert.equal(verificacionesCompartidas,rondasAdicionales+1,
   "Cada ronda debe hacer una validación nueva y compartirla entre los 64 sockets");
  assert.equal(comandosCompartidos,2*(rondasAdicionales+1),
   "Cada ronda debe consultar usuario y sede una vez, sin TTL interronda");
  assert.ok(comandosCompartidos<consultasMongo);
  console.log("[GRUK CI SOCKET REAL DEDUP COMPARISON]",JSON.stringify({
   socketsReales:64,rondasPorModo:rondasAdicionales+1,
   consultasSinDeduplicacion:consultasMongo,
   consultasConDeduplicacion:comandosCompartidos,
   porColeccionCompartidas:Object.fromEntries(consultasCompartidas),
   duracionSinDeduplicacionMs:duracionMedicionMs,
   duracionConDeduplicacionMs:duracionCompartidaMs,
   reduccionPorcentual:Math.round(100*(1-comandosCompartidos/consultasMongo)*100)/100,
   ttlMs:0,limite:64,nota:"Mongo local CI, mismo JWT; no extrapolar a JWT distintos"
  }));
  // Ahora Mongo revoca el JWT y la segunda vuelta de revalidación debe
  // expulsar todas las conexiones restantes sin fuga entre resultados.
  await Usuario.updateOne({_id:user._id},{$inc:{tokenVersion:1}});
  const segundas=[...ticks.values()].map(fn=>fn());
  await Promise.all(segundas);
  await esperar(()=>[...sockets.values()].every(s=>!s.connected));
  assert.equal(io.sockets.adapter.rooms.has("empresa-"+empresaId),false);
  assert.equal(limitador.estadisticas().activas,0);
  console.log("[GRUK CI SOCKET REAL SATURATION]",JSON.stringify({
   socketsReales:96,limite:64,rechazadosSinCapacidad:32,
   conexionesTrasPrimeraRonda:64,conexionesTrasRevocacion:0,
   maxConcurrentObserved:limitador.estadisticas().maxObservado
  }));
 }finally{
  if(mongoClient&&onMongoCommand)mongoClient.off("commandStarted",onMongoCommand);
  liberar();
  for(const ws of clients)if(ws.readyState!==WebSocket.CLOSED)ws.terminate();
  for(const s of sockets.values())s.disconnect(true);
  await new Promise(resolve=>io.close(resolve));
  if(dbConnected){await mongoose.connection.dropDatabase();await mongoose.disconnect();}
 }
});
