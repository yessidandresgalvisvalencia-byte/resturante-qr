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
const Sede=require("../../models/sede");
const Usuario=require("../../models/usuario");

const mongo=process.env.GRUK_TEST_MONGO_URI||process.env.TEST_MONGO_URI;
function local(uri){
 try{
  const u=new URL(uri);
  return u.protocol==="mongodb:"&&!u.username&&!u.password&&
   ["127.0.0.1","localhost"].includes(u.hostname)&&(!u.port||u.port==="27017");
 }catch{return false;}
}
async function esperar(check,ms=7500){
 const fin=Date.now()+ms;
 while(Date.now()<fin){
  if(check())return;
  await new Promise(resolve=>setTimeout(resolve,25));
 }
 assert.fail("Proceso Socket.IO no alcanzó el estado esperado");
}
function worker(dbName,secret){
 const child=fork(path.join(__dirname,"helpers/capa2-socket-worker.js"),[],{
  stdio:["ignore","ignore","pipe","ipc"],
  env:{...process.env,GRUK_WORKER_MONGO_URI:mongo,GRUK_WORKER_DB:dbName,
   GRUK_WORKER_SECRET:secret,GRUK_WORKER_NAME:"uno"}
 });
 const messages=[];
 child.on("message",msg=>messages.push(msg));
 const exit=new Promise(resolve=>child.once("exit",(code,signal)=>resolve({code,signal})));
 return {child,messages,exit};
}
async function conectar(port,token,clients){
 const ws=new WebSocket("ws://127.0.0.1:"+port+"/socket.io/?EIO=4&transport=websocket");
 clients.push(ws);
 return new Promise((resolve,reject)=>{
  let done=false;
  const timer=setTimeout(()=>end(Error("Timeout de handshake tras reinicio")),7000);
  function end(err,packet){
   if(done)return;
   done=true;clearTimeout(timer);
   if(err)reject(err);else resolve(packet);
  }
  ws.on("error",err=>end(err));
  ws.on("close",()=>end(Error("Cierre antes del handshake")));
  ws.on("message",data=>{
   const packet=data.toString();
   if(packet.startsWith("0"))ws.send("40"+JSON.stringify({token}));
   else if(packet==="2")ws.send("3");
   else if(packet.startsWith("40{")||packet.startsWith("44{"))end(null,packet);
  });
 });
}
async function estado(proceso){
 proceso.child.send({tipo:"estado"});
 await esperar(()=>proceso.messages.some(m=>m.tipo==="estado"),4000);
 return proceso.messages.splice(proceso.messages.findIndex(m=>m.tipo==="estado"),1)[0];
}
test("Capa 2: SIGKILL y reinicio no restauran JWT revocados; B sigue aislada",{
 skip:!mongo&&!process.env.CI,timeout:50000
},async()=>{
 assert.ok(local(mongo),"CI solo permite Mongo local sin credenciales");
 const dbName="gruk_socket_process_ci_"+randomUUID().replace(/-/g,"");
 const A="507f1f77bcf86cd799439011",B="507f1f77bcf86cd799439012";
 const SA="507f191e810c19729de860ea",SB="507f191e810c19729de860eb";
 const secret="gruk-socket-process-crash-restart-secret";
 const procesos=[],clients=[];
 let connected=false;
 try{
  await mongoose.connect(mongo,{dbName,serverSelectionTimeoutMS:10000});
  connected=true;
  await Restaurante.create([
   {restaurantId:"restart-a",empresaId:A,nombreRestaurante:"Restart A",
    correo:"restart-a@example.test",usuarioAdmin:"restart-a",passwordAdmin:"test"},
   {restaurantId:"restart-b",empresaId:B,nombreRestaurante:"Restart B",
    correo:"restart-b@example.test",usuarioAdmin:"restart-b",passwordAdmin:"test"}
  ]);
  await Sede.create([
   {_id:SA,empresaId:A,restauranteId:"restart-a",nombreSede:"A",codigoSede:"restart-a-"+randomUUID()},
   {_id:SB,empresaId:B,restauranteId:"restart-b",nombreSede:"B",codigoSede:"restart-b-"+randomUUID()}
  ]);
  const [userA,userB]=await Usuario.create([
   {empresaId:A,restauranteId:"restart-a",sedeId:SA,nombre:"A",usuario:"restart-a-"+randomUUID(),password:"test",rol:"mesero",estado:"activo"},
   {empresaId:B,restauranteId:"restart-b",sedeId:SB,nombre:"B",usuario:"restart-b-"+randomUUID(),password:"test",rol:"mesero",estado:"activo"}
  ]);
  function firmar(u,empresa,restaurant,sede,version){
   return jwt.sign({sub:String(u._id),empresaId:empresa,restaurantId:restaurant,
    sedeId:sede,rol:"EMPLEADO",identityType:"USUARIO",tokenVersion:version},
   secret,{algorithm:"HS256",expiresIn:"5m"});
  }
  const viejoA=firmar(userA,A,"restart-a",SA,0);
  const validoB=firmar(userB,B,"restart-b",SB,0);
  let p=worker(dbName,secret);procesos.push(p);
  await esperar(()=>p.messages.some(m=>m.tipo==="listo"||m.tipo==="fallo"),12000);
  let listo=p.messages.find(m=>m.tipo==="listo");
  assert.ok(listo,JSON.stringify(p.messages));
  const inicioA=await conectar(listo.puerto,viejoA,clients);
  const inicioB=await conectar(listo.puerto,validoB,clients);
  assert.ok(inicioA.startsWith("40{")&&inicioB.startsWith("40{"));
  let s=await estado(p);
  assert.equal(s.salas["empresa-"+A],1);
  assert.equal(s.salas["empresa-"+B],1);
  // SIGKILL representa fallo inesperado; NO ejecuta cierre ordenado ni
  // invalida los JWT en Mongo. La revocación ocurre durante la caída.
  p.child.kill("SIGKILL");
  const salida=await p.exit;
  assert.equal(salida.signal,"SIGKILL");
  await esperar(()=>clients.slice(0,2).every(ws=>ws.readyState===WebSocket.CLOSED),7000);
  await Usuario.updateOne({_id:userA._id},{$inc:{tokenVersion:1}});
  p=worker(dbName,secret);procesos.push(p);
  await esperar(()=>p.messages.some(m=>m.tipo==="listo"||m.tipo==="fallo"),12000);
  listo=p.messages.find(m=>m.tipo==="listo");
  assert.ok(listo,JSON.stringify(p.messages));
  // Ataque de reconexión masiva: el token A quedó invalidado mientras
  // el primer proceso estaba caído. Ninguna instancia nueva puede usar
  // la caché previa; cada handshake debe consultar Mongo.
  const intentosPorEmpresa=32;
  let rechazadosMasivos=0,aceptadosMasivos=0;
  for(let inicio=0;inicio<intentosPorEmpresa;inicio+=8){
   const lote=await Promise.all([
    ...Array.from({length:8},()=>conectar(listo.puerto,viejoA,clients)),
    ...Array.from({length:8},()=>conectar(listo.puerto,validoB,clients))
   ]);
   rechazadosMasivos+=lote.filter((frame,i)=>i<8&&frame.startsWith("44{")).length;
   aceptadosMasivos+=lote.filter((frame,i)=>i>=8&&frame.startsWith("40{")).length;
   assert.equal(rechazadosMasivos,inicio+8,"A no puede reutilizar autorizaciones de antes del crash");
   assert.equal(aceptadosMasivos,inicio+8,"B debe reconectar sin contaminación de A");
  }
  assert.equal(rechazadosMasivos,32);
  assert.equal(aceptadosMasivos,32);
  const rechazado=await conectar(listo.puerto,viejoA,clients);
  assert.ok(rechazado.startsWith("44{"),"JWT A revocado debe fallar antes de entrar a rooms");
  const bReautenticado=await conectar(listo.puerto,validoB,clients);
  assert.ok(bReautenticado.startsWith("40{"),"JWT B sigue válido tras caída de A");
  s=await estado(p);
  assert.equal(s.salas["empresa-"+A],undefined);
  assert.equal(s.salas["empresa-"+B],33);
  const nuevoA=firmar(userA,A,"restart-a",SA,1);
  const renovado=await conectar(listo.puerto,nuevoA,clients);
  assert.ok(renovado.startsWith("40{"),"Token A renovado debe entrar tras comprobar Mongo");
  s=await estado(p);
  assert.equal(s.salas["empresa-"+A],1);
  assert.equal(s.salas["empresa-"+B],33);
  // Revocar de nuevo A después del reinicio: B no debe perder conexión.
  await Usuario.updateOne({_id:userA._id},{$inc:{tokenVersion:1}});
  await esperar(()=>p.messages.some(m=>m.tipo==="desconectado"&&m.usuarioId===String(userA._id)),7000);
  s=await estado(p);
  assert.equal(s.salas["empresa-"+A],undefined);
  assert.equal(s.salas["empresa-"+B],33);
  assert.equal(s.limite.activas,0);
  console.log("[GRUK CI SOCKET CRASH RESTART]",JSON.stringify({
   procesosSucesivos:2,signalInicial:"SIGKILL",empresas:2,
   tokenRevocadoDuranteCaidaRechazado:true,
   nuevoTokenVerificadoMongo:true,empresaBSinInterrupcionTrasReinicio:true,
   roomsEmpresaATrasRevocacion:0,roomsEmpresaB:33,
   reconexionesARevocadasRechazadas:rechazadosMasivos,
   reconexionesBAutorizadas:aceptadosMasivos,
   verificacionesActivas:s.limite.activas
  }));
 }finally{
  for(const ws of clients)if(ws.readyState!==WebSocket.CLOSED)ws.terminate();
  for(const p of procesos)if(p.child.connected)p.child.send({tipo:"detener"});
  await Promise.all(procesos.map(async p=>{
   await Promise.race([p.exit,new Promise(resolve=>setTimeout(resolve,1500))]);
   if(p.child.exitCode===null&&!p.child.killed)p.child.kill("SIGKILL");
  }));
  if(connected){await mongoose.connection.dropDatabase();await mongoose.disconnect();}
 }
});
