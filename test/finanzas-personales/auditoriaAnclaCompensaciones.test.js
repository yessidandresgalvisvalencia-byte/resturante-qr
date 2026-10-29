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
