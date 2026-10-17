"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearIncrementadorRedisV81,SCRIPT}=require("../../modules/finanzas-personales/security/contadorRedisV81.service");
const id="fin:v81:write:507f1f77bcf86cd799439011";
test("Contador Redis V81 usa script atómico, clave restringida y TTL",async()=>{
 const invocaciones=[];
 const cliente={eval:async(script,options)=>{invocaciones.push({script,options});return [2,53];}};
 const incrementar=crearIncrementadorRedisV81(cliente);
 assert.deepEqual(await incrementar(id,60),{cantidad:2,restanteSegundos:53});
 assert.equal(invocaciones[0].script,SCRIPT);
 assert.deepEqual(invocaciones[0].options,{keys:[id],arguments:["60"]});
 assert.match(SCRIPT,/INCR/);assert.match(SCRIPT,/EXPIRE/);
});
test("Contador Redis V81 rechaza parámetros, respuestas y cliente defectuosos",async()=>{
 assert.throws(()=>crearIncrementadorRedisV81({}),TypeError);
 const incrementar=crearIncrementadorRedisV81({eval:async()=>[1,60]});
 await assert.rejects(incrementar("fin:v81:write:otro-usuario",60),TypeError);
 await assert.rejects(incrementar(id,0),TypeError);
 for(const respuesta of [[0,60],[1,0],[1,61],null,["invalido",10]]){
  const fallido=crearIncrementadorRedisV81({eval:async()=>respuesta});
  await assert.rejects(fallido(id,60));
 }
});
