"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const {once}=require("node:events");
const mongoose=require("mongoose");
const {buildApp}=require("../../modules/finanzas-personales/server");

test("GET /healthz falla cerrado y no filtra informacion personal sin conexion Mongo",async()=>{
 assert.notEqual(mongoose.connection.readyState,1,"Esta prueba debe correr sin Mongo conectado");
 const server=http.createServer(buildApp());
 try{
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  const address=server.address();
  assert.ok(address && typeof address!=="string");
  const response=await fetch("http://127.0.0.1:"+address.port+"/healthz",{
   cache:"no-store",
   signal:AbortSignal.timeout(5000)
  });
  assert.equal(response.status,503);
  assert.match(response.headers.get("cache-control")||"",/no-store/i);
  const body=await response.json();
  assert.deepEqual(body,{ok:false,service:"gruk-finanzas-personales"});
  const raw=JSON.stringify(body);
  assert.doesNotMatch(raw,/password|token|secret|mongo_uri|saldo|usuario|email/i);
 }finally{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
});
