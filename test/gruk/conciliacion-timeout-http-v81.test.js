"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearConsultaConciliacionCuentaV81}=require(
 "../../modules/finanzas-personales/services/consultaConciliacionCuentaV81.handler");
function respuesta(){
 const r={codigo:0,cabeceras:{},cuerpo:null};
 r.set=(nombre,valor)=>{r.cabeceras[nombre]=valor;return r;};
 r.status=(codigo)=>{r.codigo=codigo;return r;};
 r.json=(cuerpo)=>{r.cuerpo=cuerpo;return r;};
 return r;
}
const req={personalAuth:{verificado:true,userId:"507f1f77bcf86cd799439011"},
 query:{cuentaId:"507f1f77bcf86cd799439012",desde:"2025-01-01",
  hastaExclusivo:"2025-02-01",saldoInicialCop:"100.00",saldoObservadoCop:"90.00"}};
test("timeout real de Mongo responde 503 sin filtrar montos ni datos parciales",async()=>{
 for(const error of [Object.assign(new Error("operación excedida"),{code:50}),
  Object.assign(new Error("MaxTimeMSExpired"),{codeName:"MaxTimeMSExpired"})]){
  const res=respuesta();
  await crearConsultaConciliacionCuentaV81(async()=>{throw error;})(req,res);
  assert.equal(res.codigo,503);
  assert.equal(res.cabeceras["Cache-Control"],"no-store");
  assert.equal(res.cabeceras["Retry-After"],"5");
  assert.deepEqual(res.cuerpo,{ok:false,error:"Conciliación temporalmente no disponible; reintenta"});
  assert.equal(JSON.stringify(res.cuerpo).includes("saldo"),false);
 }
});
test("fallo de Mongo distinto no se disfraza como timeout",async()=>{
 const res=respuesta();
 await crearConsultaConciliacionCuentaV81(async()=>{throw new Error("interno");})(req,res);
 assert.equal(res.codigo,500);
 assert.deepEqual(res.cuerpo,{ok:false,error:"Conciliación no disponible"});
});

test("503 originado en capa financiera conserva estado seguro y Retry-After",async()=>{
 const res=respuesta();
 await crearConsultaConciliacionCuentaV81(async()=>{
  throw Object.assign(new Error("Mongo temporalmente ocupado"),{statusCode:503});
 })(req,res);
 assert.equal(res.codigo,503);
 assert.equal(res.cabeceras["Cache-Control"],"no-store");
 assert.equal(res.cabeceras["Retry-After"],"5");
 assert.deepEqual(res.cuerpo,{ok:false,error:"Conciliación temporalmente no disponible; reintenta"});
});

test("403 de autorización conserva código y no revela cuenta ajena",async()=>{
 const res=respuesta();
 await crearConsultaConciliacionCuentaV81(async()=>{
  throw Object.assign(new Error("Cuenta privada de otro usuario"),{statusCode:403});
 })(req,res);
 assert.equal(res.codigo,403);
 assert.equal(res.cabeceras["Cache-Control"],"no-store");
 assert.equal(res.cabeceras["Retry-After"],undefined);
 assert.deepEqual(res.cuerpo,{ok:false,error:"Acceso denegado"});
 assert.ok(!JSON.stringify(res.cuerpo).includes("Cuenta privada"));
});
test("401 sin identidad no ejecuta el motor de conciliación",async()=>{
 let invocado=false;
 const res=respuesta();
 await crearConsultaConciliacionCuentaV81(async()=>{invocado=true;})({
  ...req,personalAuth:{verificado:false,userId:req.personalAuth.userId}
 },res);
 assert.equal(invocado,false);
 assert.equal(res.codigo,401);
 assert.deepEqual(res.cuerpo,{ok:false,error:"Autenticación requerida"});
});

test("rangos de más de 366 días se rechazan antes de consultar Mongo",async()=>{
 let invocado=false;
 const res=respuesta();
 await crearConsultaConciliacionCuentaV81(async()=>{invocado=true;})({
  ...req,query:{...req.query,desde:"2024-01-01",hastaExclusivo:"2025-01-02"}
 },res);
 assert.equal(invocado,false);
 assert.equal(res.codigo,400);
 assert.equal(res.cabeceras["Cache-Control"],"no-store");
 assert.deepEqual(res.cuerpo,{ok:false,error:"Parámetros de conciliación inválidos"});
});
