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
 const recibido={};
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
 return {EventoModelo,recibido};
}
test("bloquea mutación antigua ante cualquier compensación existente en el mismo usuario",async()=>{
 const {EventoModelo,recibido}=dobles({evento:{tipo:"CORRECCION"}});
 const session={marker:"transaccion_activa"};
 await assert.rejects(exigirSinCompensacionesHeredadas({
  usuarioId,movimientoId,session,EventoModelo
 }),e=>e.statusCode===409&&/protegido por ledger/.test(e.message));
 assert.equal(recibido.session,session);
 assert.deepEqual(recibido.filtro,{usuarioId,movimientoId});
});
test("permite ruta heredada solo cuando no existe evento y consulta responde",async()=>{
 const {EventoModelo}=dobles();
 assert.equal(await exigirSinCompensacionesHeredadas({
  usuarioId,movimientoId,session:{},EventoModelo
 }),true);
});
test("falla cerrado si Mongo no permite comprobar el movimiento",async()=>{
 const {EventoModelo}=dobles({fallo:true});
 await assert.rejects(exigirSinCompensacionesHeredadas({
  usuarioId,movimientoId,session:{},EventoModelo
 }),e=>e.statusCode===503);
 await assert.rejects(exigirSinCompensacionesHeredadas({
  usuarioId,movimientoId,EventoModelo
 }),e=>e.statusCode===409);
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
