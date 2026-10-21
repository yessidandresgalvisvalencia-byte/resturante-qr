"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {crearCompensacionPersonalHandler}=
 require("../../modules/finanzas-personales/services/compensacionPersonal.handler");
const usuarioId="507f1f77bcf86cd799439011",movimientoId="507f1f77bcf86cd799439012";
const input={idempotencyKey:"corr_unica",tipo:"CORRECCION",
 original:{tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Comida"},
 cambios:{montoMinor:22000}};
function respuesta(){
 const salida={code:200,payload:null};
 const res={status(code){salida.code=code;return res;},
  json(payload){salida.payload=payload;return res;}};
 return {res,salida};
}
test("usuario proviene de autenticación y movimiento de URL, no de body",async()=>{
 let recibido;
 const registrar=async datos=>{
  recibido=datos;
  return {movimientoId:datos.original.movimientoId,tipo:datos.tipo,
   secuencia:1,hashActual:"a".repeat(64),deltaCajaMinor:"3000"};
 };
 const handler=crearCompensacionPersonalHandler({
  registrar,reloj:()=>new Date("2026-10-20T16:00:00.000Z")
 });
 const {res,salida}=respuesta();
 await handler({personalAuth:{userId:usuarioId},params:{id:movimientoId},
  validated:{...input,usuarioId:"usuario_ajeno",movimientoId:"falsificado"}},res);
 assert.equal(salida.code,201);
 assert.equal(recibido.original.usuarioId,usuarioId);
 assert.equal(recibido.original.movimientoId,movimientoId);
 assert.equal(recibido.fechaISO,"2026-10-20T16:00:00.000Z");
 assert.equal(salida.payload.compensacion.deltaCajaMinor,"3000");
 assert.equal(salida.payload.compensacion.hashActual,"a".repeat(64));
});
test("rechaza identidad inválida, movimiento inválido y original incompleto",async()=>{
 let llamadas=0;
 const handler=crearCompensacionPersonalHandler({registrar:async()=>{llamadas++;}});
 for(const req of [
  {personalAuth:null,params:{id:movimientoId},validated:input},
  {personalAuth:{userId:usuarioId},params:{id:"invalido"},validated:input},
  {personalAuth:{userId:usuarioId},params:{id:movimientoId},
   validated:{...input,original:{tipo:"GASTO"}}}
 ]){
  const {res,salida}=respuesta();await handler(req,res);
  assert.equal(salida.code,400);
 }
 assert.equal(llamadas,0);
});
test("errores 409 y 503 no se presentan como exitosos y 500 no expone detalles",async()=>{
 for(const codigo of [409,503,500]){
  const handler=crearCompensacionPersonalHandler({
   registrar:async()=>{throw Object.assign(new Error("detalle sensible"),{statusCode:codigo===500?undefined:codigo});}
  });
  const {res,salida}=respuesta();
  await handler({personalAuth:{userId:usuarioId},params:{id:movimientoId},validated:input},res);
  assert.equal(salida.code,codigo);
  assert.equal(salida.payload.ok,false);
  if(codigo===500)assert.ok(!salida.payload.error.includes("detalle sensible"));
 }
});
test("la ruta protegida valida idempotencia y rechaza campos desconocidos",()=>{
 const rutas=fs.readFileSync(path.join(__dirname,"../../modules/finanzas-personales/routes.js"),"utf8");
 const auth=rutas.indexOf("router.use(auth,entitlement);");
 const endpoint=rutas.indexOf('router.post("/v81/transacciones/:id/compensaciones"');
 assert.ok(endpoint>auth);
 assert.ok(rutas.slice(endpoint,endpoint+220).includes("validate(compensacionTx)"));
 assert.ok(rutas.includes('idempotencyKey:Joi.string().pattern(/^[A-Za-z0-9_-]{1,128}$/).required()'));
 assert.ok(rutas.includes('}).unknown(false).custom((value,helpers)=>'));
});
