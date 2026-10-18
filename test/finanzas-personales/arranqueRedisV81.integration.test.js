"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {iniciarControlRedisV81}=require("../../modules/finanzas-personales/security/iniciarControlRedisV81.service");
const {crearLimiteSeleccionadoV81}=require("../../modules/finanzas-personales/security/limiteSeleccionadoV81.middleware");
test("V81 arranca cliente Redis oficial real y aplica la cuota compartida",{
 skip:!process.env.GRUK_V81_TEST_REDIS_URL
},async()=>{
 const url=process.env.GRUK_V81_TEST_REDIS_URL;
 assert.equal(url,"redis://127.0.0.1:6379/0","Solo Redis efímero en localhost para pruebas");
 const original=process.env.GRUK_V81_RATE_LIMIT_MODE;
 const app={locals:{}};
 let client;
 try{
  process.env.GRUK_V81_RATE_LIMIT_MODE="redis";
  client=await iniciarControlRedisV81(app,{redis:require("redis"),url});
  assert.equal(client.isReady,true);
  const limite=crearLimiteSeleccionadoV81({modo:"redis"});
  const userId="507f1f77bcf86cd799439099";
  let aceptadas=0,bloqueadas=0;
  for(let i=0;i<21;i++){
   const salida=await new Promise((resolve,reject)=>{
    const res={codigo:200,status(n){this.codigo=n;return this;},setHeader(){},json(){resolve(this.codigo);}};
    Promise.resolve(limite({personalAuth:{userId,verificado:true},app},res,()=>resolve(200))).catch(reject);
   });
   if(salida===200)aceptadas++;else if(salida===429)bloqueadas++;
  }
  assert.equal(aceptadas,20);
  assert.equal(bloqueadas,1);
 }finally{
  delete app.locals.redisV81;
  if(client)client.destroy();
  if(original===undefined)delete process.env.GRUK_V81_RATE_LIMIT_MODE;
  else process.env.GRUK_V81_RATE_LIMIT_MODE=original;
 }
});
