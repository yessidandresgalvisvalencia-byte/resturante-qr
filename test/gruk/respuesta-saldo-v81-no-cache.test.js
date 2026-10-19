"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearConsultaSaldoV81}=require("../../modules/finanzas-personales/services/consultaSaldoV81.handler");
const usuarioId="507f1f77bcf86cd799439011";
async function consultar(operacion,autenticado=true){
 const res={statusCode:200,body:null,headers:{},
  set(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  json(x){this.body=x;return this;}};
 await crearConsultaSaldoV81(operacion)({personalAuth:{verificado:autenticado,userId:usuarioId}},res);
 return res;
}
test("saldo verificado solo responde 200 al superar la integridad del ledger",async()=>{
 const r=await consultar(async id=>{
  assert.equal(id,usuarioId);
  return {integridad:"VERIFICADA",saldoCentavos:"125000",cantidad:2};
 });
 assert.equal(r.statusCode,200);
 assert.equal(r.body.ok,true);
 assert.equal(r.headers["Cache-Control"],"no-store");
});
test("cadena fallida, no conciliable o indeterminada jamás confirma saldo",async()=>{
 for(const integridad of ["FALLIDA","NO_CONCILIABLE","DESCONOCIDA"]){
  const r=await consultar(async()=>({integridad,cantidad:2}));
  assert.equal(r.statusCode,409);
  assert.equal(r.body.ok,false);
  assert.equal(r.headers["Cache-Control"],"no-store");
  assert.equal(r.body.saldoCentavos,undefined);
 }
});
test("errores de autenticación y de Mongo no revelan información ni permiten caché",async()=>{
 const sinSesion=await consultar(async()=>{throw Error("Nunca debe entrar");},false);
 assert.equal(sinSesion.statusCode,401);
 assert.equal(sinSesion.headers["Cache-Control"],"no-store");
 const fallo=await consultar(async()=>{throw Error("mongodb://usuario:clave@interno");});
 assert.equal(fallo.statusCode,500);
 assert.equal(fallo.headers["Cache-Control"],"no-store");
 assert.equal(fallo.body.ok,false);
 assert.doesNotMatch(JSON.stringify(fallo.body),/mongodb|clave|interno/);
});
