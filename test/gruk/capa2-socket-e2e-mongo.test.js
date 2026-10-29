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
const Restaurante=require("../../models/restaurante");
const Sede=require("../../models/sede");
const {autenticarSocket}=require("../../core/auth/socketHandshake.service");
const {vigilarSesionSocket}=require("../../core/auth/socketSessionWatchdog.service");

const mongo=process.env.GRUK_TEST_MONGO_URI||process.env.TEST_MONGO_URI;
function mongoLocal(uri){
 if(typeof uri!=="string"||!uri.startsWith("mongodb://"))return false;
 try{
  const u=new URL(uri);
  return !u.username&&!u.password&&
   ["localhost","127.0.0.1","::1","[::1]"].includes(u.hostname)&&
   (!u.port||u.port==="27017");
 }catch{return false;}
}
async function esperar(check,maxMs=6000){
 const deadline=Date.now()+maxMs;
 do{
  if(await check())return;
  await new Promise(r=>setTimeout(r,50));
 }while(Date.now()<deadline);
 assert.fail("Socket.IO no alcanzó estado esperado dentro del plazo de prueba");
}
test("Capa 2 Socket.IO real: canales por empresa y revocación con MongoDB",{
 skip:!mongo&&!process.env.CI,timeout:45000
},async()=>{
 assert.ok(mongo,"CI exige MongoDB para verificar transportes reales");
 assert.ok(mongoLocal(mongo),"Solo se permiten pruebas destructivas sobre MongoDB local");
 const dbName="gruk_socket_ci_"+randomUUID().replace(/-/g,"");
 const A="507f1f77bcf86cd799439011",B="507f1f77bcf86cd799439012";
 const SA="507f191e810c19729de860ea";
 const secret="capa2-socket-real-ci-secret-32-chars";
 const server=http.createServer((req,res)=>{res.writeHead(404);res.end();});
 const io=new Server(server,{transports:["polling","websocket"],pingInterval:15000,pingTimeout:6000});
 const conectados=new Map();
 const wsClients=[];
 io.use(async(socket,next)=>{
  const auth=await autenticarSocket({token:socket.handshake.auth?.token,secret});
  if(!auth)return next(new Error("UNAUTHORIZED"));
  socket.auth=auth;
  next();
 });
 io.on("connection",socket=>{
  conectados.set(socket.id,socket);
  socket.join("empresa-"+socket.auth.empresaId);
  vigilarSesionSocket(socket,{secret,intervalMs:2000,timeoutMs:1000});
 });
 let dbConnected=false;
 const urlBase=()=> "http://127.0.0.1:"+server.address().port+"/socket.io/?EIO=4&transport=polling";
 async function get(u){
  const r=await fetch(u,{signal:AbortSignal.timeout(7000)});
  assert.equal(r.status,200);
  return r.text();
 }
 async function post(u,packet){
  const r=await fetch(u,{method:"POST",headers:{"content-type":"text/plain;charset=UTF-8"},
   body:packet,signal:AbortSignal.timeout(7000)});
  assert.equal(r.status,200);
  assert.equal(await r.text(),"ok");
 }
 async function handshakeWebsocket(token){
  const address="ws://127.0.0.1:"+server.address().port+
   "/socket.io/?EIO=4&transport=websocket";
  const ws=new WebSocket(address);
  wsClients.push(ws);
  const packet=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error("WebSocket handshake sin respuesta")),7000);
   const done=(err,payload)=>{
    clearTimeout(timeout);
    if(err)reject(err);else resolve(payload);
   };
   ws.once("error",error=>done(error));
   ws.on("message",data=>{
    const frame=data.toString();
    if(frame.startsWith("0"))ws.send("40"+JSON.stringify({token}));
    else if(frame==="2")ws.send("3");
    else if(frame.startsWith("40{")||frame.startsWith("44{"))done(null,frame);
   });
   ws.once("close",()=>done(Error("WebSocket cerrado durante handshake")));
  });
  return {ws,packet};
 }
 async function handshake(token){
  const open=await get(urlBase());
  assert.ok(open.startsWith("0"),open);
  const sid=JSON.parse(open.slice(1)).sid;
  const url=urlBase()+"&sid="+encodeURIComponent(sid);
  // Socket.IO namespace CONNECT packet con auth real, no cliente simulado.
  await post(url,"40"+JSON.stringify({token}));
  const response=await get(url);
  return {sid,response,url};
 }
 try{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  await mongoose.connect(mongo,{dbName,serverSelectionTimeoutMS:15000});
  dbConnected=true;
  await Restaurante.create([
   {restaurantId:"socket-a",empresaId:A,nombreRestaurante:"Socket A",
    correo:"socket-a@example.test",usuarioAdmin:"sa",passwordAdmin:"solo-test"},
   {restaurantId:"socket-b",empresaId:B,nombreRestaurante:"Socket B",
    correo:"socket-b@example.test",usuarioAdmin:"sb",passwordAdmin:"solo-test"}
  ]);
  await Sede.create({_id:SA,empresaId:A,restauranteId:"socket-a",
   nombreSede:"Socket sede",codigoSede:"socket-ci-"+randomUUID()});
  const user=await Usuario.create({
   empresaId:A,restauranteId:"socket-a",sedeId:SA,
   nombre:"Empleado socket",usuario:"socket-"+randomUUID(),
   password:"test-only",rol:"mesero",estado:"activo"
  });
  const claims={sub:String(user._id),empresaId:A,
   restaurantId:"socket-a",sedeId:SA,rol:"EMPLEADO",
   identityType:"USUARIO",tokenVersion:0};
  const valid=jwt.sign(claims,secret,{algorithm:"HS256",expiresIn:"5m"});
  const session=await handshake(valid);
  assert.match(session.response,/40\{/,"El servidor debe aceptar la conexión Socket.IO");
  const socketId=JSON.parse(session.response.slice(session.response.indexOf("40")+2)).sid;
  await esperar(()=>conectados.get(socketId)?.rooms.has("empresa-"+A));
  assert.equal(conectados.get(socketId).rooms.has("empresa-"+B),false,
   "La empresa B jamás puede compartir el canal del usuario A");
  const forged=jwt.sign({...claims,empresaId:B},secret,{algorithm:"HS256",expiresIn:"5m"});
  const rejected=await handshake(forged);
  assert.match(rejected.response,/44\{/,"El tenant falsificado debe ser rechazado en el handshake");
  assert.equal(conectados.size,1,"El token falsificado no debe crear un socket");
  // Transporte WebSocket nativo: handshake Engine.IO y namespace Socket.IO.
  const wsValido=await handshakeWebsocket(valid);
  assert.match(wsValido.packet,/^40\{/,"El WebSocket nativo debe autenticarse");
  const websocketId=JSON.parse(wsValido.packet.slice(2)).sid;
  await esperar(()=>conectados.get(websocketId)?.rooms.has("empresa-"+A));
  assert.equal(conectados.get(websocketId).rooms.has("empresa-"+B),false);
  const wsFalso=await handshakeWebsocket(forged);
  assert.match(wsFalso.packet,/^44\{/,
   "WebSocket nativo debe rechazar una empresa falsificada");
  assert.equal(conectados.size,2,"Solo polling y WebSocket legítimos pueden unirse");

  // Carga moderada con transportes WebSocket REALES y MongoDB de pruebas.
  // CI mide latencias observadas: no se proclama SLA sin carga de staging.
  // Carga real en lotes: evita picos de apertura del runner que ocultan
  // la medición de revalidación de sesiones contra MongoDB.
  const totalAdicionales=98;
  const tamanoLote=14;
  const inicioConexiones=Date.now();
  const adicionales=[];
  for(let desde=0;desde<totalAdicionales;desde+=tamanoLote){
   const lote=await Promise.all(Array.from({
    length:Math.min(tamanoLote,totalAdicionales-desde)
   },async()=>{
    const inicio=Date.now();
    const sesion=await handshakeWebsocket(valid);
    assert.equal(sesion.packet.startsWith("40{"),true);
    return {id:JSON.parse(sesion.packet.slice(2)).sid,latenciaMs:Date.now()-inicio};
   }));
   adicionales.push(...lote);
  }
  const idsAdicionales=adicionales.map(x=>x.id);
  await esperar(()=>idsAdicionales.every(id=>
   conectados.get(id)?.rooms.has("empresa-"+A)),6000);
  assert.equal(new Set(idsAdicionales).size,totalAdicionales);
  assert.equal(conectados.size,totalAdicionales+2);
  assert.equal(idsAdicionales.every(id=>!conectados.get(id).rooms.has("empresa-"+B)),true);
  const latenciasConexion=adicionales.map(x=>x.latenciaMs).sort((a,b)=>a-b);
  const p95Conexion=latenciasConexion[Math.ceil(latenciasConexion.length*.95)-1];
  // Dos comprobaciones periódicas para confirmar conexiones sostenidas.
  await new Promise(resolve=>setTimeout(resolve,4400));
  assert.equal(idsAdicionales.every(id=>conectados.get(id)?.connected),true,
   "Las conexiones legítimas deben sobrevivir a la revalidación periódica");
  const inicioRevocacion=Date.now();

  await Usuario.updateOne({_id:user._id},{$inc:{tokenVersion:1}});
  await esperar(()=>!conectados.get(socketId)?.connected &&
   !conectados.get(websocketId)?.connected &&
   idsAdicionales.every(id=>!conectados.get(id)?.connected),10000);
  const latenciaRevocacionMs=Date.now()-inicioRevocacion;
  console.log("[GRUK CI SOCKET LOAD]",JSON.stringify({
   conexionesReales:totalAdicionales+2,
   transporte:"websocket+polling",tiempoConexionesMs:inicioRevocacion-inicioConexiones,
   p95HandshakeMs:p95Conexion,latenciaRevocacionMs,
   duracionSostenidaMs:4400,limiteDeCarga:"CI local, sin SLA"
  }));
  assert.equal(io.sockets.adapter.rooms.has("empresa-"+A),false,
   "El socket revocado ya no puede permanecer en el canal de la empresa");
 }finally{
  for(const ws of wsClients){if(ws.readyState!==WebSocket.CLOSED)ws.terminate();}
  for(const socket of conectados.values())socket.disconnect(true);
  await new Promise(resolve=>io.close(resolve));
  if(dbConnected){await mongoose.connection.dropDatabase();await mongoose.disconnect();}
 }
});
