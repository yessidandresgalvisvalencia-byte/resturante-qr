"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearConsultaIntegridadV81}=require("../../modules/finanzas-personales/services/consultaIntegridadV81.handler");
const ID="507f1f77bcf86cd799439011";
function respuesta(){
 return {code:200,headers:{},payload:null,status(n){this.code=n;return this;},set(k,v){this.headers[k]=v;return this;},json(x){this.payload=x;return this;}};
}
test("V81 HTTP deniega principal ausente o no verificado antes de leer Mongo",async()=>{
 let consultas=0;
 const handler=crearConsultaIntegridadV81(async()=>{consultas++;return {integridad:"VERIFICADA"};});
 for(const personalAuth of [undefined,{userId:ID},{userId:ID,verificado:false},{userId:"invalido",verificado:true}]){
  const res=respuesta();await handler({personalAuth,body:{usuarioId:ID},query:{usuarioId:ID}},res);
  assert.equal(res.code,401);assert.equal(res.payload.ok,false);
 }
 assert.equal(consultas,0);
});
test("V81 HTTP consulta exclusivamente cuenta validada y evita caché",async()=>{
 const vistas=[];const handler=crearConsultaIntegridadV81(async(id)=>{vistas.push(id);return {integridad:"SIN_MOVIMIENTOS",cantidad:0};});
 const res=respuesta();
 await handler({personalAuth:{userId:ID,verificado:true},query:{usuarioId:"507f191e810c19729de860ea"},body:{usuarioId:"507f191e810c19729de860ea"}},res);
 assert.deepEqual(vistas,[ID]);assert.equal(res.code,200);assert.equal(res.headers["Cache-Control"],"no-store");assert.equal(res.payload.auditoria.integridad,"SIN_MOVIMIENTOS");
});
test("V81 HTTP oculta errores internos y no revela datos",async()=>{
 const handler=crearConsultaIntegridadV81(async()=>{throw new Error("informacion secreta");});
 const res=respuesta();await handler({personalAuth:{userId:ID,verificado:true}},res);
 assert.equal(res.code,500);assert.equal(JSON.stringify(res.payload).includes("informacion secreta"),false);
});
