"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearLimiteMovimientosV81}=require("../../modules/finanzas-personales/security/limiteMovimientosV81.middleware");
const a="507f1f77bcf86cd799439011",b="507f191e810c19729de860ea";
function res(){return {statusCode:200,headers:{},data:null,status(n){this.statusCode=n;return this;},setHeader(k,v){this.headers[k]=v;},json(o){this.data=o;return this;}};}
function llamar(mw,principal,body={}){let next=0;const out=res();mw({personalAuth:principal,body},out,()=>{next++;});return {next,...out};}
test("V81 limita escrituras de una cuenta y conserva ventana",()=>{
 let momento=10000;const mw=crearLimiteMovimientosV81({max:2,windowMs:1000,now:()=>momento});
 const p={userId:a,verificado:true};
 assert.equal(llamar(mw,p).next,1);
 assert.equal(llamar(mw,p).next,1);
 const tercero=llamar(mw,p);assert.equal(tercero.next,0);assert.equal(tercero.statusCode,429);assert.equal(tercero.headers["Retry-After"],"1");
 assert.equal(llamar(mw,{userId:b,verificado:true}).next,1);
 momento+=1000;assert.equal(llamar(mw,p).next,1);
});
test("V81 deniega identidad no verificada sin consumir límite",()=>{
 const mw=crearLimiteMovimientosV81({max:1});
 assert.equal(llamar(mw,{userId:a,verificado:false}).statusCode,401);
 assert.equal(llamar(mw,{userId:a,verificado:true}).next,1);
 assert.equal(llamar(mw,{userId:a,verificado:true}).statusCode,429);
});
test("V81 exige configuración válida",()=>{
 assert.throws(()=>crearLimiteMovimientosV81({max:0}),TypeError);
 assert.throws(()=>crearLimiteMovimientosV81({windowMs:100}),TypeError);
});
