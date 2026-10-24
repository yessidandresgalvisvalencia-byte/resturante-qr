"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {validarObligacion,crearRegistradorObligacionPersonal}=require(
 "../../modules/finanzas-personales/services/registrarObligacionPersonal.service");
const uid="507f1f77bcf86cd799439011";
const input={montoMinor:500000,concepto:"Arriendo",categoria:"Vivienda",
 fecha:"2026-11-15T12:00:00Z",recurrente:true,frecuencia:"MENSUAL",
 externalId:"arriendo-2026-11"};
test("construye compromiso sin caja, cuenta ni crédito ficticio",()=>{
 const o=validarObligacion(uid,input);
 assert.equal(o.impactoCaja,false);
 assert.equal(o.tipo,"GASTO");
 assert.equal(o.cuentaId,null);
 assert.equal(o.cuenta,"SIN_CAJA");
 assert.equal(o.montoMinor,500000);
 assert.equal(o.recurrente,true);
});
test("rechaza importes inseguros, falsas recurrencias, campos y vencimientos inválidos",()=>{
 for(const cambio of [
  {montoMinor:0},{montoMinor:1.5},{montoMinor:Number.MAX_SAFE_INTEGER+1},
  {recurrente:false},{frecuencia:"NINGUNA"},{frecuencia:"QUINCENAL",recurrente:false},
  {fecha:"no-fecha"},{externalId:""},{impactoCaja:true},{cuenta:"EFECTIVO"}
 ])assert.throws(()=>validarObligacion(uid,{...input,...cambio}),e=>e.statusCode===400);
});
test("inserta sin operaciones de saldo y bloquea replay idempotente",async()=>{
 const previo=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 process.env.PERSONAL_IDEMPOTENCY_SECRET="clave-de-pruebas-aislada";
 const sesion={async withTransaction(fn){await fn();},async endSession(){}};
 let guardado=null,creaciones=0,verificaciones=0;
 const Modelo={
  findOne(f){return {session(s){assert.equal(s,sesion);return {
   async lean(){return guardado&&guardado.externalIdHash===f.externalIdHash?guardado:null;}
  };}};},
  async create(rows,{session}){assert.equal(session,sesion);creaciones++;
   guardado={...rows[0],_id:"507f1f77bcf86cd799439012"};return [guardado];}
 };
 try{
  const registrar=crearRegistradorObligacionPersonal({
   MovimientoModelo:Modelo,nuevaSesion:async()=>sesion,
   verificarIndice:async()=>{verificaciones++;}
  });
  const r=await registrar(uid,input);
  assert.equal(r.impactoCaja,false);
  assert.equal(creaciones,1);
  await assert.rejects(()=>registrar(uid,input),e=>e.statusCode===409);
  assert.equal(creaciones,1);
  assert.equal(verificaciones,2);
 }finally{
  if(previo===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
  else process.env.PERSONAL_IDEMPOTENCY_SECRET=previo;
 }
});
test("ruta prevista está detrás de autenticación global y no llama registrador de pagos",()=>{
 const src=fs.readFileSync(path.join(__dirname,"../../modules/finanzas-personales/routes.js"),"utf8");
 const i=src.indexOf('router.post("/v81/obligaciones-previstas"');
 assert.ok(i>src.indexOf("router.use(auth,entitlement);"));
 const block=src.slice(i,i+620);
 assert.ok(block.includes("req.personalAuth.userId"));
 assert.ok(block.includes("crearRegistradorObligacionPersonal"));
 assert.ok(!block.includes("registrarTransaccion("));
});

test("respuesta HTTP expone campos permitidos, jamás hash interno",()=>{
 const src=fs.readFileSync(path.join(__dirname,"../../modules/finanzas-personales/routes.js"),"utf8");
 const start=src.indexOf('router.post("/v81/obligaciones-previstas"');
 const end=src.indexOf('router.post("/transacciones"',start);
 const block=src.slice(start,end);
 assert.ok(block.includes("id:String(obligacion._id)"));
 assert.ok(block.includes("impactoCaja:false"));
 assert.ok(!block.includes("externalIdHash"));
 assert.ok(!block.includes("obligacion,impactoCaja:false"));
});

test("vencimientos no aceptan epochs ni formatos sin zona horaria",()=>{
 for(const fecha of [
  1794744000000,"2026-11-15","2026-11-15T12:00:00",
  "11/15/2026",null,{},true
 ])assert.throws(()=>validarObligacion(uid,{...input,fecha}),
  e=>e.statusCode===400);
});
test("admite fecha ISO con zona y Date emitido por Joi",()=>{
 for(const fecha of ["2026-11-15T12:00:00Z",
  "2026-11-15T07:00:00-05:00",new Date("2026-11-15T12:00:00Z")]){
  const v=validarObligacion(uid,{...input,fecha});
  assert.equal(v.fecha.toISOString(),"2026-11-15T12:00:00.000Z");
 }
});

test("rechaza vencimientos calendario imposibles aunque Date los normalice",()=>{
 for(const fecha of [
  "2026-02-30T12:00:00Z",
  "2026-04-31T12:00:00-05:00",
  "2026-13-01T12:00:00Z",
  "2026-11-15T25:00:00Z",
  "2026-11-15T12:60:00Z",
  "2026-11-15T12:00:00+24:00",
  "2026-11-15T12:00:00-05:60"
 ])assert.throws(()=>validarObligacion(uid,{...input,fecha}),
  e=>e.statusCode===400);
});
test("acepta 29 de febrero bisiesto con offset colombiano",()=>{
 const v=validarObligacion(uid,{...input,
  fecha:"2028-02-29T07:15:00-05:00"});
 assert.equal(v.fecha.toISOString(),"2028-02-29T12:15:00.000Z");
});
