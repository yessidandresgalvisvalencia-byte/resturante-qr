"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearLimiteSeleccionadoV81}=require("../../modules/finanzas-personales/security/limiteSeleccionadoV81.middleware");
const id="507f1f77bcf86cd799439011";
function respuesta(){return {code:200,headers:{},status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;},json(o){this.body=o;return this;}};}
test("V81 redis rechaza si falta cliente sin recurrir al contador local",async()=>{
 const mw=crearLimiteSeleccionadoV81({modo:"redis"});
 const res=respuesta();await mw({personalAuth:{userId:id,verificado:true},app:{locals:{}}},res,()=>assert.fail("No permitir"));
 assert.equal(res.code,503);
});
test("V81 redis usa cliente inyectado del servidor y comparte cuota",async()=>{
 let count=0;
 const cliente={eval:async()=>[++count,30]};
 const mw=crearLimiteSeleccionadoV81({modo:"redis"});
 const req={personalAuth:{userId:id,verificado:true},app:{locals:{redisV81:cliente}}};
 for(let i=0;i<20;i++){const res=respuesta();let next=0;await mw(req,res,()=>{next++;});assert.equal(next,1);}
 const res=respuesta();await mw(req,res,()=>assert.fail("Debe bloquear"));assert.equal(res.code,429);assert.equal(res.headers["Retry-After"],"30");
});
test("V81 rechaza modos desconocidos",()=>assert.throws(()=>crearLimiteSeleccionadoV81({modo:"off"}),TypeError));
