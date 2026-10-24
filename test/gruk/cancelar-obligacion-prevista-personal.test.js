"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {crearCanceladorObligacion}=require(
 "../../modules/finanzas-personales/services/cancelarObligacionPrevistaPersonal.service");
const uid="507f1f77bcf86cd799439011",id="507f1f77bcf86cd799439012";
const original={_id:id,usuarioId:uid,tipo:"GASTO",impactoCaja:false,
 cuentaId:null,cuenta:"SIN_CAJA",origen:"MANUAL",estado:"ACTIVA",
 montoMinor:500000,concepto:"Arriendo",categoria:"Vivienda",
 fecha:new Date("2026-11-15T12:00:00Z"),frecuencia:"MENSUAL",recurrente:true};
function dobles({abono=false,reserva=false}={}){
 let eventos=[],consulta=null;
 const sesion={async withTransaction(fn){await fn();},async endSession(){}};
 const MovimientoModelo={
  findOne(f){consulta=f;return {session(s){assert.equal(s,sesion);
   return {lean:async()=>original};}};},
  exists(f){return {session(s){assert.equal(s,sesion);
   return Promise.resolve(abono?{_id:"abono"}:null);}};}
 };
 const ReservaModelo={exists(f){return {session(s){assert.equal(s,sesion);
  return Promise.resolve(reserva?{_id:"reserva"}:null);}};}};
 const CancelacionModelo={
  async create(rows,{session}){assert.equal(session,sesion);
   if(eventos.length){const e=Error("duplicate");e.code=11000;throw e;}
   eventos.push(rows[0]);return rows;}
 };
 return {MovimientoModelo,ReservaModelo,CancelacionModelo,
  nuevaSesion:async()=>sesion,verificar:async()=>true,
  eventos:()=>eventos,consulta:()=>consulta};
}
test("cancelación solo crea evento independiente sin modificar original ni saldos",async()=>{
 const prev=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 process.env.PERSONAL_IDEMPOTENCY_SECRET="clave-local-pruebas";
 try{
  const d=dobles(),cancelar=crearCanceladorObligacion(d);
  const e=await cancelar(uid,id,{idempotencyKey:"arriendo_cancel",motivo:"Ya no aplica"});
  assert.equal(e.tipo,"CANCELACION_OBLIGACION_PREVISTA");
  assert.equal(e.snapshot.montoMinor,500000);
  assert.equal(e.motivo,"Ya no aplica");
  assert.equal(d.eventos().length,1);
  assert.equal(d.consulta().cuentaId,null);
  assert.equal(original.estado,"ACTIVA");
  assert.equal(e.idempotencyHash.length,64);
  await assert.rejects(()=>cancelar(uid,id,{idempotencyKey:"arriendo_cancel",
   motivo:"Ya no aplica"}),er=>er.statusCode===409);
 }finally{
  if(prev===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
  else process.env.PERSONAL_IDEMPOTENCY_SECRET=prev;
 }
});
test("niega cancelaciones con abonos o reservas",async()=>{
 const prev=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 process.env.PERSONAL_IDEMPOTENCY_SECRET="clave-local-pruebas";
 try{
  for(const scenario of [{abono:true},{reserva:true}]){
   const d=dobles(scenario),cancelar=crearCanceladorObligacion(d);
   await assert.rejects(()=>cancelar(uid,id,{idempotencyKey:"k",motivo:"no aplica"}),
    e=>e.statusCode===409&&/pagos o reservas/.test(e.message));
   assert.equal(d.eventos().length,0);
  }
 }finally{
  if(prev===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
  else process.env.PERSONAL_IDEMPOTENCY_SECRET=prev;
 }
});
test("rechaza IDs, motivos y claves inválidos sin iniciar Mongo",async()=>{
 const cancelar=crearCanceladorObligacion();
 for(const [u,i,data] of [
  ["bad",id,{idempotencyKey:"ok",motivo:"x"}],
  [uid,"bad",{idempotencyKey:"ok",motivo:"x"}],
  [uid,id,{idempotencyKey:"",motivo:"x"}],
  [uid,id,{idempotencyKey:"ok",motivo:" "}]
 ])await assert.rejects(()=>cancelar(u,i,data),e=>e.statusCode===400);
});
test("modelo append-only bloquea updates y deletes por middleware",()=>{
 const src=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/models/CancelacionObligacionPrevistaPersonal.js"),"utf8");
 assert.ok(src.includes('unique:true,name:"fp_cancelacion_unica_obligacion"'));
 assert.ok(src.includes('unique:true,name:"fp_cancelacion_idempotencia"'));
 assert.ok(src.includes('schema.pre("deleteOne"'));
 assert.ok(src.includes('schema.pre("save"'));
});
