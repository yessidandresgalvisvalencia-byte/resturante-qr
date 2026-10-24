"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {exigirSinCompensacionesHeredadas}=
 require("../../modules/finanzas-personales/services/guardiaMutacionLegadaPersonal.service");
const usuarioId="507f1f77bcf86cd799439011";
const movimientoId="507f1f77bcf86cd799439012";
function dobles({evento=null,fallo=false}={}){
 const recibido={revision:0,escrituras:0};
 const CursorModelo={
  findById(){return {session(){return {lean:async()=>recibido.cursor||null};}};},
  async create(rows){recibido.cursor={...rows[0]};return rows;},
  async findOneAndUpdate(){recibido.escrituras++;recibido.revision++;
   recibido.cursor={...recibido.cursor,revisionLegada:recibido.revision};
   return recibido.cursor;}
 };
 const EventoModelo={
  findOne(filtro){
   recibido.filtro=filtro;
   return {session(session){
    recibido.session=session;
    return {lean:async()=>{
     if(fallo)throw new Error("Mongo no disponible");
     return evento;
    }};
   }};
  }
 };
 return {EventoModelo,CursorModelo,recibido};
}
test("bloquea mutación antigua ante cualquier compensación existente en el mismo usuario",async()=>{
 const {EventoModelo,CursorModelo,recibido}=dobles({evento:{tipo:"CORRECCION"}});
 const session={marker:"transaccion_activa"};
 await assert.rejects(exigirSinCompensacionesHeredadas({
  usuarioId,movimientoId,session,EventoModelo,CursorModelo
 }),e=>e.statusCode===409&&/protegido por ledger/.test(e.message));
 assert.equal(recibido.session,session);
 assert.deepEqual(recibido.filtro,{usuarioId,movimientoId});
 assert.equal(recibido.escrituras,0);
});
test("permite ruta heredada solo cuando no existe evento y consulta responde",async()=>{
 const {EventoModelo,CursorModelo,recibido}=dobles();
 assert.equal(await exigirSinCompensacionesHeredadas({
  usuarioId,movimientoId,session:{},EventoModelo,CursorModelo
 }),true);
 assert.equal(recibido.escrituras,1);
 assert.equal(recibido.cursor.secuencia,0);
 assert.equal(recibido.cursor.hashActual,"0".repeat(64));
});
test("falla cerrado si Mongo no permite comprobar el movimiento",async()=>{
 const {EventoModelo,CursorModelo,recibido}=dobles({fallo:true});
 await assert.rejects(exigirSinCompensacionesHeredadas({
  usuarioId,movimientoId,session:{},EventoModelo
 }),e=>e.statusCode===503);
 await assert.rejects(exigirSinCompensacionesHeredadas({
  usuarioId,movimientoId,EventoModelo,CursorModelo
 }),e=>e.statusCode===409);
 assert.equal(recibido.escrituras,0);
});
test("las dos rutas heredadas verifican guardia dentro del transaction callback antes de mutar",()=>{
 const texto=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/services/flujoCajaPersonal.service.js"),"utf8");
 for(const [inicio,fin,identidad] of [
  ["async function corregirTransaccion","async function anularTransaccion","anterior._id"],
  ["async function anularTransaccion","module.exports=","tx._id"]
 ]){
  const tramo=texto.slice(texto.indexOf(inicio),texto.indexOf(fin,texto.indexOf(inicio)));
  const guardia="await exigirSinCompensacionesHeredadas({usuarioId,movimientoId:"+identidad+",session});";
  assert.ok(tramo.includes(guardia),"Falta guardia en "+inicio);
  assert.ok(tramo.indexOf(guardia)<tramo.indexOf("Cuenta.findOneAndUpdate"),
   "La guardia debe preceder todo ajuste de caja");
  assert.ok(tramo.indexOf(guardia)<tramo.indexOf(".save({session})"),
   "La guardia debe preceder toda mutación del original");
 }
});

test("PATCH y DELETE legados se detienen antes de ajustar caja sin pago real",()=>{
 const source=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/services/flujoCajaPersonal.service.js"),"utf8");
 for(const [inicio,fin,variable] of [
  ["async function corregirTransaccion","async function anularTransaccion","anterior"],
  ["async function anularTransaccion","module.exports=","tx"]
 ]){
  const cuerpo=source.slice(source.indexOf(inicio),source.indexOf(fin,source.indexOf(inicio)));
  const guardia=`if(${variable}.impactoCaja===false)`;
  assert.ok(cuerpo.includes(guardia),`Falta protección de movimientos no monetarios en ${inicio}`);
  assert.ok(cuerpo.indexOf(guardia)<cuerpo.indexOf("Cuenta.findOneAndUpdate"));
  assert.ok(cuerpo.indexOf(guardia)<cuerpo.indexOf(".save({session})"));
 }
});
