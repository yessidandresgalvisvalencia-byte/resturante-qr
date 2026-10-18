"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearConsultaConciliacionCuentaV81,parsearSaldoFirmadoCopACentavos}=
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

test("saldo observado negativo en COP se interpreta exactamente con BigInt",async()=>{
 assert.equal(parsearSaldoFirmadoCopACentavos("-1250.25"),-125025n);
 assert.equal(parsearSaldoFirmadoCopACentavos("0.10"),10n);
 assert.equal(parsearSaldoFirmadoCopACentavos("0.20"),20n);
 assert.equal(parsearSaldoFirmadoCopACentavos("-0.30"),-30n);
 assert.equal(parsearSaldoFirmadoCopACentavos("0.10")+parsearSaldoFirmadoCopACentavos("0.20"),30n);
 const consulta=await invocar(async args=>{
  assert.equal(args.saldoInicialCentavos,-125025n);
  assert.equal(args.saldoObservadoCentavos,-130025n);
  return {estado:"CONCILIADA",movimientosEvaluados:1};
 },{...query,saldoInicialCop:"-1250.25",saldoObservadoCop:"-1300.25"});
 assert.equal(consulta.statusCode,200);
 assert.equal(consulta.body.conciliacion.aptoParaDisponibleHoy,false);
});
test("saldos con notación flotante o formato ambiguo se rechazan",()=>{
 for(const valor of ["-","--1","1e3","-1e3","1,000","-1,000.00","-.5","1.234","+5"," 1","- 1",1,null]){
  assert.throws(()=>parsearSaldoFirmadoCopACentavos(valor),TypeError,String(valor));
 }
});
test("errores de conciliación no se almacenan en cachés intermedias",async()=>{
 for(const [error,status] of [
  [Object.assign(new Error("huérfano"),{statusCode:409}),409],
  [Object.assign(new Error("sin acceso"),{statusCode:401}),401],
  [new TypeError("mal formado"),400],
  [new Error("interno"),500]
 ]){
  const r=await invocar(async()=>{throw error;});
  assert.equal(r.statusCode,status);
  assert.equal(r.headers["Cache-Control"],"no-store");
 }
});

test("saldos excesivamente largos se rechazan antes de convertirlos a BigInt",async()=>{
 const maximo="9".repeat(15);
 assert.equal(parsearSaldoFirmadoCopACentavos(maximo+".99"),
  BigInt(maximo)*100n+99n);
 assert.equal(parsearSaldoFirmadoCopACentavos("-"+maximo+".99"),
  -(BigInt(maximo)*100n+99n));
 for(const valor of ["9".repeat(16),"9".repeat(200000),
   "-"+("9".repeat(16)),"0".repeat(500),"0.123","-0.001"]){
  assert.throws(()=>parsearSaldoFirmadoCopACentavos(valor),TypeError);
 }
 const r=await invocar(async()=>{throw Error("No debe consultar la base");},{
  ...query,saldoInicialCop:"9".repeat(200000)
 });
 assert.equal(r.statusCode,400);
 assert.equal(r.headers["Cache-Control"],"no-store");
});
