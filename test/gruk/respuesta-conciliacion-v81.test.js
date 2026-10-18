"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearConsultaConciliacionCuentaV81}=
 require("../../modules/finanzas-personales/services/consultaConciliacionCuentaV81.handler");
const uid="507f1f77bcf86cd799439011",cuentaId="507f1f77bcf86cd799439013";
const query={cuentaId,desde:"2025-01-01",hastaExclusivo:"2025-02-01",
 saldoInicialCop:"0",saldoObservadoCop:"0"};
async function invocar(consultar,q=query){
 const res={statusCode:200,body:null,headers:{},
  status(n){this.statusCode=n;return this;},json(x){this.body=x;return this;},
  set(k,v){this.headers[k]=v;return this;}};
 await crearConsultaConciliacionCuentaV81(consultar)({
  personalAuth:{verificado:true,userId:uid},query:q
 },res);
 return res;
}
test("un movimiento huérfano conserva HTTP 409 sin fingir error interno",async()=>{
 const res=await invocar(async()=>{throw Object.assign(
  new Error("Movimientos sin cuentaId"),{statusCode:409});});
 assert.equal(res.statusCode,409);
 assert.equal(res.body.ok,false);
 assert.match(res.body.error,/sin vincular/);
});
test("fallo interno no revela información de Mongo",async()=>{
 const res=await invocar(async()=>{throw Error("mongodb://usuario:clave@interno");});
 assert.equal(res.statusCode,500);
 assert.equal(res.body.ok,false);
 assert.doesNotMatch(res.body.error,/mongodb|clave|interno/);
});
test("conciliación verificada aritméticamente nunca equivale a saldo bancario verificado",async()=>{
 const res=await invocar(async()=>({estado:"CONCILIADA",movimientosEvaluados:0}));
 assert.equal(res.statusCode,200);
 assert.equal(res.body.conciliacion.saldoBancarioVerificado,false);
 assert.equal(res.body.conciliacion.aptoParaDisponibleHoy,false);
 assert.equal(res.headers["Cache-Control"],"no-store");
});
