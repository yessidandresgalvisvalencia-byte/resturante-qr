"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const express=require("express");
const {registerHttpHealthRoutes}=require("../../core/health/httpHealth.routes");
const SHA="a".repeat(40);
async function probe(state,commit=SHA){
 const db={connection:{readyState:state}};
 const app=express();
 registerHttpHealthRoutes(app,db,{version:"1.2.3",commit,uptime:()=>14.99});
 const server=app.listen(0,"127.0.0.1");
 try{
  await new Promise((resolve,reject)=>{if(server.listening)resolve();else{server.once("listening",resolve);server.once("error",reject);}});
  const addr=server.address();
  const get=async path=>{
   const response=await fetch("http://127.0.0.1:"+addr.port+path,{redirect:"manual"});
   return {status:response.status,cache:response.headers.get("cache-control"),body:await response.json()};
  };
  return {health:await get("/health"),ready:await get("/ready")};
 }finally{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
}
test("HTTP real: /health y /ready responden 200 con Mongo conectado, commit y no-store",async()=>{
 const {health,ready}=await probe(1);
 assert.equal(health.status,200);
 assert.equal(ready.status,200);
 assert.equal(health.cache,"no-store");
 assert.equal(ready.cache,"no-store");
 assert.deepEqual(health.body,{status:"ok",version:"1.2.3",commit:SHA,db:"connected",uptime:14});
 assert.deepEqual(ready.body,{ready:true,db:"connected"});
});
test("HTTP real: /health y /ready rechazan Mongo desconectado con 503",async()=>{
 for(const state of [0,2,3]){
  const {health,ready}=await probe(state);
  assert.equal(health.status,503);assert.equal(ready.status,503);
  assert.equal(health.body.status,"degraded");
  assert.equal(health.body.db,"disconnected");
  assert.equal(ready.body.ready,false);
  assert.equal(ready.body.db,"disconnected");
 }
});
test("HTTP real: un SHA inválido nunca se anuncia como commit desplegado",async()=>{
 const {health}=await probe(1,"sin-commit");
 assert.equal(health.status,200);
 assert.equal(health.body.commit,null);
});
