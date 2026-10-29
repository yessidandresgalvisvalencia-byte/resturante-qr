"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const mongoose=require("mongoose");
const jwt=require("jsonwebtoken");
const WebSocket=require("ws");
const {Server}=require("socket.io");
const {randomUUID}=require("node:crypto");
const Usuario=require("../../models/usuario");
const Sede=require("../../models/sede");
const Restaurante=require("../../models/restaurante");
const {autenticarSocket}=require("../../core/auth/socketHandshake.service");
const {vigilarSesionSocket}=require("../../core/auth/socketSessionWatchdog.service");
const {crearVerificadorCompartido}=require("../../core/auth/socketSharedVerifier.service");
const {crearLimiteValidaciones}=require("../../core/auth/socketValidationLimiter.service");

const mongo=process.env.GRUK_TEST_MONGO_URI||process.env.TEST_MONGO_URI;
function soloMongoLocal(uri){
 try{
  const u=new URL(uri);
  return u.protocol==="mongodb:"&&!u.username&&!u.password&&
   ["localhost","127.0.0.1"].includes(u.hostname)&&(!u.port||u.port==="27017");
 }catch{return false;}
}
async function esperar(condicion,plazo=7000){
 const limite=Date.now()+plazo;
 while(Date.now()<limite){
  if(condicion())return;
  await new Promise(r=>setTimeout(r,30));
 }
 assert.fail("No se alcanzó el estado de sesiones esperado");
}
async function abrirSocket(url,token,clients){
 const ws=new WebSocket(url);
 clients.push(ws);
 return new Promise((resolve,reject)=>{
  let terminado=false;
  const timeout=setTimeout(()=>fin(Error("Timeout en handshake WebSocket")),7000);
  function fin(error,frame){
   if(terminado)return;
   terminado=true;
   clearTimeout(timeout);
   if(error)reject(error);else resolve(frame);
  }
  ws.on("error",error=>fin(error));
  ws.on("close",()=>fin(Error("WebSocket cerrado durante handshake")));
  ws.on("message",data=>{
   const frame=data.toString();
   if(frame.startsWith("0"))ws.send("40"+JSON.stringify({token}));
   else if(frame==="2")ws.send("3");
   else if(frame.startsWith("40{")||frame.startsWith("44{"))fin(null,frame);
  });
 });
}
test("Capa 2 Mongo: 32 JWT distintos, 32 WebSockets, sin ahorro ficticio entre empresas",{
 skip:!mongo&&!process.env.CI,timeout:60000
},async()=>{
 assert.ok(soloMongoLocal(mongo),"Solo MongoDB local y sin credenciales para prueba CI");
 const dbName="gruk_socket_ci_"+randomUUID().replace(/-/g,"");
 const empresas=[
  {id:"507f1f77bcf86cd799439011",sede:"507f191e810c19729de860ea",restaurantId:"unique-empresa-a"},
  {id:"507f1f77bcf86cd799439012",sede:"507f191e810c19729de860eb",restaurantId:"unique-empresa-b"}
 ];
 const secret="gruk-capa2-unique-jwt-ci-secret-32";
 const servidor=http.createServer((req,res)=>{res.writeHead(404);res.end();});
 const io=new Server(servidor,{transports:["websocket"],pingInterval:15000,pingTimeout:6000});
 const sockets=new Map(),ticks=new Map(),clients=[];
 const limitador=crearLimiteValidaciones({maxConcurrent:64});
 // La caché de prueba deduplica solo consultas en curso: cero TTL entre rondas.
 const compartido=crearVerificadorCompartido({ttlMs:0,tiempoConsultaMs:1500});
 let modoCompartido=false,conectado=false,clienteMongo=null,monitor=null;
 io.use(async(socket,next)=>{
  const auth=await autenticarSocket({token:socket.handshake.auth?.token,secret});
  if(!auth)return next(Error("UNAUTHORIZED"));
  socket.auth=auth;next();
 });
 io.on("connection",socket=>{
  sockets.set(socket.id,socket);
  socket.join("empresa-"+socket.auth.empresaId);
  vigilarSesionSocket(socket,{
   secret,intervalMs:5000,timeoutMs:2500,limite:limitador,
   autenticar:({token,secret:clave,signal})=>modoCompartido
    ?compartido.autenticar({token,secret:clave,signal})
    :autenticarSocket({token,secret:clave,signal}),
   programar:fn=>{ticks.set(socket.id,fn);return 1;},
   cancelar:()=>ticks.delete(socket.id)
  });
 });
 try{
  await new Promise(resolve=>servidor.listen(0,"127.0.0.1",resolve));
  await mongoose.connect(mongo,{dbName,serverSelectionTimeoutMS:15000,monitorCommands:true});
  conectado=true;
  for(const e of empresas){
   await Restaurante.create({restaurantId:e.restaurantId,empresaId:e.id,
    nombreRestaurante:"Empresa "+e.restaurantId,
    correo:e.restaurantId+"@example.test",usuarioAdmin:e.restaurantId,passwordAdmin:"test"});
   await Sede.create({_id:e.sede,empresaId:e.id,restauranteId:e.restaurantId,
    nombreSede:"Sede CI",codigoSede:e.restaurantId+"-"+randomUUID()});
  }
  const identidades=[];
  for(const e of empresas){
   const usuarios=await Usuario.insertMany(Array.from({length:16},(_,i)=>({
    empresaId:e.id,restauranteId:e.restaurantId,sedeId:e.sede,
    nombre:"Usuario "+i,usuario:e.restaurantId+"-"+randomUUID(),
    password:"test",rol:"mesero",estado:"activo"
   })));
   for(const user of usuarios){
    identidades.push({empresaId:e.id,usuarioId:user._id,token:jwt.sign({
     sub:String(user._id),empresaId:e.id,restaurantId:e.restaurantId,
     sedeId:e.sede,rol:"EMPLEADO",identityType:"USUARIO",tokenVersion:0
    },secret,{algorithm:"HS256",expiresIn:"5m"})});
   }
  }
  const url="ws://127.0.0.1:"+servidor.address().port+
   "/socket.io/?EIO=4&transport=websocket";
  for(let start=0;start<identidades.length;start+=8){
   const lote=identidades.slice(start,start+8);
   const resultados=await Promise.all(lote.map(u=>abrirSocket(url,u.token,clients)));
   assert.equal(resultados.every(f=>f.startsWith("40{")),true);
  }
  await esperar(()=>ticks.size===32);
  assert.equal(sockets.size,32);
  for(const e of empresas){
   assert.equal(io.sockets.adapter.rooms.get("empresa-"+e.id)?.size,16);
   assert.equal([...sockets.values()].filter(s=>s.auth.empresaId===e.id).length,16);
  }
  clienteMongo=mongoose.connection.getClient();
  async function medir(modo){
   modoCompartido=modo==="compartido";
   const consultas=new Map();
   const listener=evento=>{
    if(evento.commandName!=="find")return;
    const coll=String(evento.command?.find||"desconocida");
    consultas.set(coll,(consultas.get(coll)||0)+1);
   };
   monitor=listener;
   clienteMongo.on("commandStarted",listener);
   const antes=compartido.estadisticas().consultas;
   const inicio=Date.now();
   try{
    for(let ronda=0;ronda<4;ronda++){
     await Promise.all([...ticks.values()].map(fn=>fn()));
     assert.equal(limitador.estadisticas().activas,0);
     assert.equal(ticks.size,32,"Ningún JWT válido puede perder sesión");
     assert.equal(limitador.estadisticas().rechazadas,0);
    }
   }finally{
    clienteMongo.off("commandStarted",listener);
    monitor=null;
   }
   return {
    total:[...consultas.values()].reduce((n,x)=>n+x,0),
    porColeccion:Object.fromEntries(consultas),
    ms:Date.now()-inicio,
    validacionesCompartidas:compartido.estadisticas().consultas-antes
   };
  }
  const individual=await medir("individual");
  const agrupado=await medir("compartido");
  assert.equal(individual.total,32*4*2,
   "Sin deduplicar deben verse 2 consultas por socket/ronda");
  assert.equal(agrupado.total,32*4*2,
   "Con deduplicación un JWT debe exigir usuario+sede por ronda");
  assert.equal(agrupado.validacionesCompartidas,32*4,
   "No compartir resultados entre tokens o rondas");
  const reduccion=100*(1-agrupado.total/individual.total);
  assert.equal(reduccion,0,"JWT únicos sin conexiones repetidas no reducen consultas");
  // Revocar solo A: B mantiene sus 16 conexiones incluso después de
  // revalidar ambas empresas en la misma ronda.
  const a=identidades.filter(x=>x.empresaId===empresas[0].id);
  await Usuario.updateMany({_id:{$in:a.map(x=>x.usuarioId)}},
   {$inc:{tokenVersion:1}});
  await Promise.all([...ticks.values()].map(fn=>fn()));
  await esperar(()=>io.sockets.adapter.rooms.has("empresa-"+empresas[0].id)===false);
  assert.equal(io.sockets.adapter.rooms.get("empresa-"+empresas[1].id)?.size,16);
  assert.equal(ticks.size,16,"Solo deben quedar las 16 sesiones legítimas de B");
  const b=identidades.filter(x=>x.empresaId===empresas[1].id);
  await Usuario.updateMany({_id:{$in:b.map(x=>x.usuarioId)}},
   {$inc:{tokenVersion:1}});
  await Promise.all([...ticks.values()].map(fn=>fn()));
  await esperar(()=>ticks.size===0);
  assert.equal(limitador.estadisticas().activas,0);
  console.log("[GRUK CI SOCKET UNIQUE JWT COMPARISON]",JSON.stringify({
   empresas:2,usuariosDistintos:32,websocketsReales:32,rondas:4,
   consultasIndividuales:individual.total,consultasCompartidas:agrupado.total,
   porColeccionIndividual:Object.fromEntries(Object.entries(individual.porColeccion)),
   porColeccionCompartida:agrupado.porColeccion,
   reduccionPorcentual:reduccion,
   validacionesJWTCompartidas:agrupado.validacionesCompartidas,
   revocacionEmpresaASinAfectarB:true,sesionesTrasRevocarAmbas:0,
   limiteConcurrente:64,medicion:"Mongo local CI, 1 socket por JWT"
  }));
 }finally{
  if(clienteMongo&&monitor)clienteMongo.off("commandStarted",monitor);
  for(const ws of clients)if(ws.readyState!==WebSocket.CLOSED)ws.terminate();
  for(const s of sockets.values())s.disconnect(true);
  await new Promise(resolve=>io.close(resolve));
  if(conectado){await mongoose.connection.dropDatabase();await mongoose.disconnect();}
 }
});
