"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {crearFabricaClienteRedisV81}=require("../../modules/finanzas-personales/security/fabricaClienteRedisV81.service");
test("Fábrica Redis V81 crea cliente oficial y registra observador de errores",()=>{
 let config;
 const client=Object.assign(new EventEmitter(),{eval:async()=>[1,60],connect:async()=>{},ping:async()=>"PONG"});
 const fabrica=crearFabricaClienteRedisV81({createClient:opciones=>{config=opciones;return client;}});
 assert.equal(fabrica({url:"rediss://redis.example.test"}),client);
 assert.equal(config.url,"rediss://redis.example.test");
 assert.equal(typeof config.socket.reconnectStrategy,"function");
 assert.ok(client.listenerCount("error")>0);
});
test("Fábrica Redis V81 rechaza clientes incompatibles",()=>{
 assert.throws(()=>crearFabricaClienteRedisV81({}),TypeError);
 assert.throws(()=>crearFabricaClienteRedisV81({createClient:()=>({})})({url:"rediss://redis.example.test"}),TypeError);
});
