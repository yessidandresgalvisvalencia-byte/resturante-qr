"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {iniciarControlRedisV81}=require("../../modules/finanzas-personales/security/iniciarControlRedisV81.service");
test("Inicio aislado de Redis V81 exige modo Redis configurado",async()=>{
 const original=process.env.GRUK_V81_RATE_LIMIT_MODE;
 try{
  delete process.env.GRUK_V81_RATE_LIMIT_MODE;
  await assert.rejects(iniciarControlRedisV81({locals:{}},{redis:{createClient(){}}}),/MODE/);
  process.env.GRUK_V81_RATE_LIMIT_MODE="redis";
  await assert.rejects(iniciarControlRedisV81({locals:{}},{redis:{},url:"rediss://example.test"}),/instalada/);
  const app={locals:{}};
  const cliente=Object.assign(new EventEmitter(),{isReady:true,eval:async()=>[1,60],async connect(){},async ping(){return "PONG";}});
  assert.equal(await iniciarControlRedisV81(app,{redis:{createClient:()=>cliente},url:"rediss://example.test"}),cliente);
  assert.equal(app.locals.redisV81,cliente);
 }finally{if(original===undefined)delete process.env.GRUK_V81_RATE_LIMIT_MODE;else process.env.GRUK_V81_RATE_LIMIT_MODE=original;}
});
