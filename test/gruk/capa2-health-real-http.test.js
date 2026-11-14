"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const express=require("express");
const {registerHttpHealthRoutes}=require("../../core/health/httpHealth.routes");
const SHA="c".repeat(40);

async function withHealthServer(callback){
 const app=express();
 const estado={connection:{readyState:0}};
 registerHttpHealthRoutes(app,estado,{version:"1.0.0",commit:SHA,uptime:()=>12.9});
 const server=app.listen(0,"127.0.0.1");
 await new Promise(resolve=>server.once("listening",resolve));
 const origin="http://127.0.0.1:"+server.address().port;
 try{return await callback({origin,estado});}
 finally{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
}
async function read(origin,path){
 const response=await fetch(origin+path,{signal:AbortSignal.timeout(5000)});
 return {status:response.status,cache:response.headers.get("cache-control"),
  data:await response.json()};
}
test("Capa 2: /health y /ready reales deniegan tráfico si Mongo está desconectado",async()=>{
 await withHealthServer(async({origin})=>{
  const [health,ready]=await Promise.all([read(origin,"/health"),read(origin,"/ready")]);
  assert.equal(health.status,503);
  assert.equal(ready.status,503);
  assert.deepEqual(health.data,{
   status:"degraded",version:"1.0.0",commit:SHA,db:"disconnected",uptime:12
  });
  assert.deepEqual(ready.data,{ready:false,db:"disconnected"});
  assert.equal(health.cache,"no-store");
  assert.equal(ready.cache,"no-store");
 });
});
test("Capa 2: /health y /ready reales responden 200 solo al conectar Mongo",async()=>{
 await withHealthServer(async({origin,estado})=>{
  estado.connection.readyState=1;
  const [health,ready]=await Promise.all([read(origin,"/health"),read(origin,"/ready")]);
  assert.equal(health.status,200);
  assert.equal(ready.status,200);
  assert.equal(health.data.status,"ok");
  assert.equal(health.data.commit,SHA);
  assert.equal(ready.data.ready,true);
  assert.equal(ready.data.db,"connected");
  estado.connection.readyState=2; // Mongo connecting: fail closed
  assert.equal((await read(origin,"/health")).status,503);
  assert.equal((await read(origin,"/ready")).status,503);
 });
});
test("Capa 2: health nunca publica un SHA de despliegue malformado",async()=>{
 const app=express();
 const mongoose={connection:{readyState:1}};
 registerHttpHealthRoutes(app,mongoose,{version:"1.0.0",commit:"main"});
 const server=app.listen(0,"127.0.0.1");
 await new Promise(resolve=>server.once("listening",resolve));
 try{
  const result=await read("http://127.0.0.1:"+server.address().port,"/health");
  assert.equal(result.status,200);
  assert.equal(result.data.commit,null,
   "No afirmar que staging está en el commit correcto sin SHA verificado");
 }finally{await new Promise(resolve=>server.close(resolve));}
});
