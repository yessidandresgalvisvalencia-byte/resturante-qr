"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {iniciarRedisV81}=require("../../modules/finanzas-personales/security/iniciarRedisV81.service");
test("V81 inicia cliente Redis e inyecta solamente tras conexión lista",async()=>{
 const app={locals:{}};
 const cliente={isReady:false,eval:async()=>[1,60],async connect(){assert.equal(app.locals.redisV81,undefined);this.isReady=true;}};
 const result=await iniciarRedisV81(app,{url:"rediss://redis.example.test:6380",crearCliente:({url})=>{assert.match(url,/rediss:/);return cliente;}});
 assert.equal(result,cliente);assert.equal(app.locals.redisV81,cliente);
});
test("V81 falla cerrado sin credenciales ni cliente listo",async()=>{
 const app={locals:{redisV81:{}}};
 await assert.rejects(iniciarRedisV81(app,{url:""}));
 await assert.rejects(iniciarRedisV81(app,{url:"https://bad.example",crearCliente:()=>({})}));
 await assert.rejects(iniciarRedisV81(app,{url:"rediss://redis.example.test",crearCliente:()=>({eval(){},async connect(){},isReady:false})}));
 assert.equal(app.locals.redisV81,undefined);
});
test("V81 producción exige conexión TLS",async()=>{
 const antes=process.env.NODE_ENV;
 try{
  process.env.NODE_ENV="production";
  await assert.rejects(iniciarRedisV81({locals:{}},{url:"redis://127.0.0.1:6379",crearCliente:()=>({})}),/TLS/);
 }finally{if(antes===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=antes;}
});
