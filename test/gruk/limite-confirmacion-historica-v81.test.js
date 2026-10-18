"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearLimiteConfirmacionHistoricaV81}=require("../../modules/finanzas-personales/security/limiteConfirmacionHistoricaV81.middleware");
const ORIGINAL=process.env.PERSONAL_RATE_LIMIT_SECRET;
const user="507f1f77bcf86cd799439011";
function request(middleware,id=user){
 const response={headers:{},statusCode:200,body:null,setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
 let nextCalls=0;
 middleware({personalAuth:{verificado:true,userId:id}},response,()=>{nextCalls++;});
 return {status:response.statusCode,body:response.body,nextCalls,headers:response.headers};
}
test("cuota por usuario, bloqueo 429 y ventana renovada",()=>{
 process.env.PERSONAL_RATE_LIMIT_SECRET="prueba-no-produccion";
 try{
  let time=10000;
  const m=crearLimiteConfirmacionHistoricaV81({max:2,windowMs:2000,reloj:()=>time});
  assert.equal(request(m).nextCalls,1);
  assert.equal(request(m).nextCalls,1);
  const blocked=request(m);
  assert.equal(blocked.status,429);
  assert.equal(blocked.headers["Retry-After"],"2");
  assert.equal(request(m,"507f1f77bcf86cd799439012").nextCalls,1);
  time+=2000;
  assert.equal(request(m).nextCalls,1);
 }finally{if(ORIGINAL===undefined)delete process.env.PERSONAL_RATE_LIMIT_SECRET;else process.env.PERSONAL_RATE_LIMIT_SECRET=ORIGINAL;}
});
test("identidad no verificada y secreto ausente bloquean escritura",()=>{
 const m=crearLimiteConfirmacionHistoricaV81({max:1});
 assert.equal(request(m,"invalido").status,503);
});
test("no permite límites de seguridad inválidos",()=>{
 assert.throws(()=>crearLimiteConfirmacionHistoricaV81({max:0}),TypeError);
 assert.throws(()=>crearLimiteConfirmacionHistoricaV81({windowMs:0}),TypeError);
});
