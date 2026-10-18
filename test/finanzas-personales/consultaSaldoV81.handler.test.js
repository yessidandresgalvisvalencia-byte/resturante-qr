"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearConsultaSaldoV81}=require("../../modules/finanzas-personales/services/consultaSaldoV81.handler");
const usuarioId="507f1f77bcf86cd799439011";
function llamar(handler,auth){const res={code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};return handler({personalAuth:auth},res).then(()=>res);}
test("V81 saldo requiere sesión verificada e identidad de JWT",async()=>{
 let consultas=0;
 const handler=crearConsultaSaldoV81(async(id)=>{consultas++;assert.equal(id,usuarioId);return {integridad:"VERIFICADA",saldoCentavos:"30"};});
 const sin=await llamar(handler,{userId:usuarioId,verificado:false});assert.equal(sin.code,401);assert.equal(consultas,0);
 const bien=await llamar(handler,{userId:usuarioId,verificado:true});assert.equal(bien.code,200);assert.equal(bien.body.saldoCentavos,"30");assert.equal(bien.headers["Cache-Control"],"no-store");
});
test("V81 nunca muestra saldo cuando falla integridad o proyección",async()=>{
 for(const integridad of ["FALLIDA","NO_CONCILIABLE"]){
  const res=await llamar(crearConsultaSaldoV81(async()=>({integridad,cantidad:1})),{userId:usuarioId,verificado:true});
  assert.equal(res.code,409);assert.equal(res.body.ok,false);assert.equal(res.body.saldoCentavos,undefined);
 }
});
