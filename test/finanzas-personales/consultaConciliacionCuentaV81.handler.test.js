"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {crearConsultaConciliacionCuentaV81}=require("../../modules/finanzas-personales/services/consultaConciliacionCuentaV81.handler");
const userId="507f1f77bcf86cd799439011",cuentaId="507f191e810c19729de860ea";
const query={cuentaId,desde:"2026-10-01",hastaExclusivo:"2026-11-01",saldoInicialCop:"100.10",saldoObservadoCop:"90.05"};
function llamar(handler,auth,q=query){const res={code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(v){this.data=v;return this;}};return handler({personalAuth:auth,query:q},res).then(()=>res);}
test("Conciliación V81 toma usuario solo de sesión verificada y montos BigInt",async()=>{
 let llamadas=0;
 const handler=crearConsultaConciliacionCuentaV81(async input=>{llamadas++;assert.equal(input.usuarioId,userId);assert.equal(input.saldoInicialCentavos,10010n);assert.equal(input.saldoObservadoCentavos,9005n);return {estado:"DIFERENCIA",diferenciaCentavos:"-1005"};});
 assert.equal((await llamar(handler,{userId,verificado:false})).code,401);assert.equal(llamadas,0);
 const ok=await llamar(handler,{userId,verificado:true});assert.equal(ok.code,200);assert.equal(ok.headers["Cache-Control"],"no-store");assert.equal(llamadas,1);
});
test("Conciliación V81 rechaza identidad inyectada y montos inseguros",async()=>{
 const handler=crearConsultaConciliacionCuentaV81(async()=>assert.fail("Nunca consultar"));
 for(const q of [{...query,usuarioId:"507f191e810c19729de860ea"},{...query,saldoInicialCop:100.1},{...query,cuentaId:"otro"}]){
  assert.equal((await llamar(handler,{userId,verificado:true},q)).code,400);
 }
});
