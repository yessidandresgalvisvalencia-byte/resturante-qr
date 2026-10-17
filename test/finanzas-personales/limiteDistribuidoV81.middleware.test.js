"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearLimiteDistribuidoV81}=require("../../modules/finanzas-personales/security/limiteDistribuidoV81.middleware");
const id="507f1f77bcf86cd799439011";
function invocar(mw,auth){return new Promise(resolve=>{const r={code:200,headers:{},status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;},json(x){resolve({code:this.code,data:x,headers:this.headers})}};Promise.resolve(mw({personalAuth:auth},r,()=>resolve({code:200}))).catch(reject=>resolve({code:500,error:String(reject)}));});}
test("V81 distribuido limita por cuenta en instancias independientes",async()=>{
 const buckets=new Map();const incrementar=async key=>{const n=(buckets.get(key)||0)+1;buckets.set(key,n);return {cantidad:n,restanteSegundos:45};};
 const uno=crearLimiteDistribuidoV81({incrementar,limite:2}),dos=crearLimiteDistribuidoV81({incrementar,limite:2});
 const auth={userId:id,verificado:true};
 assert.equal((await invocar(uno,auth)).code,200);assert.equal((await invocar(dos,auth)).code,200);
 const bloqueada=await invocar(uno,auth);assert.equal(bloqueada.code,429);assert.equal(bloqueada.headers["Retry-After"],"45");
});
test("V81 distribuido falla cerrado y niega identidades inválidas",async()=>{
 const mw=crearLimiteDistribuidoV81({incrementar:async()=>{throw Error("Redis caído")}});
 assert.equal((await invocar(mw,{userId:id,verificado:false})).code,401);
 assert.equal((await invocar(mw,{userId:id,verificado:true})).code,503);
 const inconsistente=crearLimiteDistribuidoV81({incrementar:async()=>({cantidad:NaN,restanteSegundos:0})});
 assert.equal((await invocar(inconsistente,{userId:id,verificado:true})).code,503);
});
