"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {fork}=require("node:child_process");
const path=require("node:path");
const {randomUUID}=require("node:crypto");
const jwt=require("jsonwebtoken");
const WebSocket=require("ws");
const mongoose=require("mongoose");
const Restaurante=require("../../models/restaurante");
const Usuario=require("../../models/usuario");
const Sede=require("../../models/sede");

const mongo=process.env.GRUK_TEST_MONGO_URI||process.env.TEST_MONGO_URI;
function mongoLocal(uri){
 try{
  const u=new URL(uri);
  return u.protocol==="mongodb:"&&!u.username&&!u.password&&
   ["127.0.0.1","localhost"].includes(u.hostname)&&(!u.port||u.port==="27017");
 }catch{return false;}
}
async function esperar(predicado,ms=7000){
 const inicio=Date.now();
 while(Date.now()-inicio<ms){
  if(predicado())return;
  await new Promise(resolve=>setTimeout(resolve,40));
 }
 assert.fail("Los procesos Socket.IO no alcanzaron el estado esperado");
}
function iniciarWorker(nombre,dbName,secret){
 const child=fork(path.join(__dirname,"helpers/capa2-socket-worker.js"),[],{
  stdio:["ignore","ignore","pipe","ipc"],
  env:{...process.env,GRUK_WORKER_MONGO_URI:mongo,GRUK_WORKER_DB:dbName,
   GRUK_WORKER_SECRET:secret,GRUK_WORKER_NAME:nombre}
 });
 const mensajes=[];
 child.on("message",msg=>mensajes.push(msg));
 const salida=new Promise(resolve=>child.once("exit",(code,signal)=>resolve({code,signal})));
 return {child,mensajes,salida};
}
async function abrirWebSocket(puerto,token,clientes){
 const ws=new WebSocket("ws://127.0.0.1:"+puerto+"/socket.io/?EIO=4&transport=websocket");
 clientes.push(ws);
 return new Promise((resolve,reject)=>{
  let terminado=false;
  const timeout=setTimeout(()=>finish(Error("Handshake WebSocket excedió plazo")),7000);
  function finish(err,packet){
   if(terminado)return;
   terminado=true;clearTimeout(timeout);
   if(err)reject(err);else resolve(packet);
  }
  ws.on("error",err=>finish(err));
  ws.on("close",()=>finish(Error("Conexión cerrada antes del handshake")));
  ws.on("message",data=>{
   const packet=data.toString();
   if(packet.startsWith("0"))ws.send("40"+JSON.stringify({token}));
   else if(packet==="2")ws.send("3");
   else if(packet.startsWith("40{")||packet.startsWith("44{"))finish(null,packet);
  });
 });
}
test("Capa 2: dos procesos Node reales, revocaciones y rooms multiempresa",{
 skip:!mongo&&!process.env.CI,timeout:40000
},async()=>{
 assert.ok(mongoLocal(mongo),"MongoDB CI debe ser local y sin credenciales");
 const dbName="gruk_socket_process_ci_"+randomUUID().replace(/-/g,"");
 const A="507f1f77bcf86cd799439011",B="507f1f77bcf86cd799439012";
 const SA="507f191e810c19729de860ea",SB="507f191e810c19729de860eb";
 const secret="gruk-socket-multiproceso-ci-secret-32";
 const procesos=[],clientes=[];
 let connected=false;
 try{
  await mongoose.connect(mongo,{dbName,serverSelectionTimeoutMS:10000});
  connected=true;
  await Restaurante.create([
   {restaurantId:"proc-a",empresaId:A,nombreRestaurante:"Proceso A",
    correo:"proc-a@example.test",usuarioAdmin:"proc-a",passwordAdmin:"test"},
   {restaurantId:"proc-b",empresaId:B,nombreRestaurante:"Proceso B",
    correo:"proc-b@example.test",usuarioAdmin:"proc-b",passwordAdmin:"test"}
  ]);
  await Sede.create([
   {_id:SA,empresaId:A,restauranteId:"proc-a",nombreSede:"Sede A",codigoSede:"proc-a-"+randomUUID()},
   {_id:SB,empresaId:B,restauranteId:"proc-b",nombreSede:"Sede B",codigoSede:"proc-b-"+randomUUID()}
  ]);
  const [userA,userB]=await Usuario.create([
   {empresaId:A,restauranteId:"proc-a",sedeId:SA,
    nombre:"Usuario A",usuario:"process-a-"+randomUUID(),password:"test",rol:"mesero",estado:"activo"},
   {empresaId:B,restauranteId:"proc-b",sedeId:SB,
    nombre:"Usuario B",usuario:"process-b-"+randomUUID(),password:"test",rol:"mesero",estado:"activo"}
  ]);
  const token=(user,empresa,restaurante,sede)=>jwt.sign({
   sub:String(user._id),empresaId:empresa,restaurantId:restaurante,
   sedeId:sede,rol:"EMPLEADO",identityType:"USUARIO",tokenVersion:0
  },secret,{algorithm:"HS256",expiresIn:"5m"});
  const tokenA=token(userA,A,"proc-a",SA),tokenB=token(userB,B,"proc-b",SB);
  const uno=iniciarWorker("uno",dbName,secret),dos=iniciarWorker("dos",dbName,secret);
  procesos.push(uno,dos);
  await esperar(()=>procesos.every(p=>p.mensajes.some(m=>m.tipo==="listo"||m.tipo==="fallo")),11000);
  for(const p of procesos){
   const msg=p.mensajes.find(m=>m.tipo==="listo");
   assert.ok(msg,"El proceso independiente debe iniciar correctamente: "+JSON.stringify(p.mensajes));
   p.puerto=msg.puerto;
  }
  for(const p of procesos){
   assert.ok((await abrirWebSocket(p.puerto,tokenA,clientes)).startsWith("40{"));
   assert.ok((await abrirWebSocket(p.puerto,tokenB,clientes)).startsWith("40{"));
  }
  const pedirEstado=async()=>{
   for(const p of procesos)p.child.send({tipo:"estado"});
   await esperar(()=>procesos.every(p=>p.mensajes.some(m=>m.tipo==="estado")),4000);
   return procesos.map(p=>{
    const i=p.mensajes.findIndex(m=>m.tipo==="estado");
    const [msg]=p.mensajes.splice(i,1);
    return msg;
   });
  };
  let estados=await pedirEstado();
  assert.equal(estados.every(s=>s.salas["empresa-"+A]===1&&s.salas["empresa-"+B]===1),true,
   "Ambos procesos deben tener un canal aislado por empresa");
  const inicio=Date.now();
  await Usuario.updateOne({_id:userA._id},{$inc:{tokenVersion:1}});
  await esperar(()=>procesos.every(p=>p.mensajes.some(m=>
   m.tipo==="desconectado"&&m.usuarioId===String(userA._id))),6000);
  const revocacionMs=Date.now()-inicio;
  estados=await pedirEstado();
  assert.equal(estados.every(s=>!s.salas["empresa-"+A]&&s.salas["empresa-"+B]===1),true,
   "Revocar A en Mongo debe cerrar ambos procesos sin afectar B");
  assert.equal(estados.every(s=>s.limite.activas===0),true);
  await Usuario.updateOne({_id:userB._id},{$inc:{tokenVersion:1}});
  await esperar(()=>procesos.every(p=>p.mensajes.some(m=>
   m.tipo==="desconectado"&&m.usuarioId===String(userB._id))),6000);
  estados=await pedirEstado();
  assert.equal(estados.every(s=>!s.salas["empresa-"+A]&&!s.salas["empresa-"+B]),true);
  console.log("[GRUK CI SOCKET PROCESSES]",JSON.stringify({
   procesosNode:2,conexionesReales:4,empresas:2,
   revocacionEnAmbosProcesosMs:revocacionMs,
   BConservaConexionAlRevocarA:true,cacheLocalPorProceso:true
  }));
 }finally{
  for(const ws of clientes){if(ws.readyState!==WebSocket.CLOSED)ws.terminate();}
  for(const p of procesos){
   if(p.child.connected)p.child.send({tipo:"detener"});
  }
  await Promise.all(procesos.map(async p=>{
   await Promise.race([p.salida,new Promise(resolve=>setTimeout(resolve,2000))]);
   if(p.child.exitCode===null)p.child.kill("SIGKILL");
  }));
  if(connected){
   await mongoose.connection.dropDatabase();
   await mongoose.disconnect();
  }
 }
});
