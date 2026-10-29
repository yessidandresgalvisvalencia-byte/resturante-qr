"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {auditarAnclaCompensaciones:auditar}=require("../../modules/finanzas-personales/services/auditoriaAnclaCompensacionesPersonal.service");
const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519");
const usuarioId="507f1f77bcf86cd799439011";
test("sin identidad, clave pública o custodio no se consulta MongoDB",async()=>{
 assert.equal((await auditar({usuarioId:"otro",clavePublica:publicKey})).codigo,"USUARIO_INVALIDO");
 assert.equal((await auditar({usuarioId,clavePublica:privateKey})).codigo,"CLAVE_PUBLICA_NO_CONFIGURADA");
 assert.equal((await auditar({usuarioId,clavePublica:publicKey})).codigo,"CUSTODIO_EXTERNO_NO_CONFIGURADO");
});
test("fallos y respuestas ausentes del custodio no confirman integridad ni filtran errores",async()=>{
 const r=await auditar({usuarioId,clavePublica:publicKey,custodio:{obtenerUltimaAncla:async()=>{throw Error("secreto-del-proveedor");}}});
 assert.deepEqual(r,{valida:false,codigo:"CUSTODIO_EXTERNO_NO_DISPONIBLE",certificaCustodiaIndependiente:false});
 assert.equal((await auditar({usuarioId,clavePublica:publicKey,custodio:{obtenerUltimaAncla:async()=>null}})).codigo,"ANCLA_EXTERNA_NO_DISPONIBLE");
});
test("una referencia disponible no inicia sesión si MongoDB está desconectado",async t=>{
 const mongoose=require("mongoose");assert.equal(mongoose.connection.readyState,0);
 const sesion=t.mock.method(mongoose,"startSession",async()=>{throw Error("NO_DEBE_ESPERAR_CONEXION");});
 const r=await auditar({usuarioId,clavePublica:publicKey,custodio:{obtenerUltimaAncla:async()=>({referencia:"prueba"})}});
 assert.equal(r.codigo,"LECTURA_LEDGER_NO_DISPONIBLE");assert.equal(r.valida,false);
 assert.equal(sesion.mock.callCount(),0);
});
test("un custodio que no responde agota el plazo y recibe cancelación",{timeout:10000},async()=>{
 let signal;
 const r=await auditar({usuarioId,clavePublica:publicKey,custodio:{obtenerUltimaAncla:(_id,opciones)=>{
  signal=opciones.signal;return new Promise(()=>{});
 }}});
 assert.equal(signal.aborted,true);assert.equal(r.codigo,"CUSTODIO_EXTERNO_NO_DISPONIBLE");
 assert.equal(r.valida,false);assert.equal(r.certificaCustodiaIndependiente,false);
});
