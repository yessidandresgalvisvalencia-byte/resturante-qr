"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {DOMINIO,payloadAnclaCompensaciones,verificarAnclaCompensaciones:verificar}=require("../../modules/finanzas-personales/security/anclaCompensacionesPersonal.service");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const usuarioId="507f1f77bcf86cd799439011";
const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519"); // Solo fixture de prueba.
const original={usuarioId,movimientoId:"507f1f77bcf86cd799439012",tipo:"GASTO",montoMinor:1000,concepto:"Prueba",categoria:"OTROS"};
function evento(montoMinor=900){return eventoCompensatorio({original,tipo:"CORRECCION",cambios:{montoMinor},
 idempotencyKey:"ancla-prueba",fechaISO:"2026-10-29T12:00:00.000Z",secuencia:1,prevHash:"0".repeat(64)});}
function firmar(e){
 const a={version:1,dominio:DOMINIO,algoritmo:"Ed25519",usuarioId,secuencia:e.secuencia,headHash:e.hashActual,emitidaEn:"2026-10-29T13:00:00.000Z"};
 return {...a,firma:crypto.sign(null,payloadAnclaCompensaciones(a),privateKey).toString("base64")};
}
const cursor=e=>({_id:usuarioId,secuencia:e.secuencia,hashActual:e.hashActual});
test("verifica un compromiso firmado sin afirmar custodia independiente",()=>{
 const e=evento(),r=verificar({ancla:firmar(e),clavePublica:publicKey,eventos:[e],cursor:cursor(e),usuarioId});
 assert.equal(r.valida,true);assert.equal(r.certificaCustodiaIndependiente,false);
});
test("rechaza una reescritura coherente aunque sus hashes locales sean válidos",()=>{
 const original=evento(),reescrito=evento(800);
 assert.equal(verificar({ancla:firmar(original),clavePublica:publicKey,eventos:[reescrito],cursor:cursor(reescrito),usuarioId}).codigo,"ANCLA_NO_COINCIDE");
});
test("rechaza firma, identidad, metadatos y claves incorrectos",()=>{
 const e=evento(),base={ancla:firmar(e),clavePublica:publicKey,eventos:[e],cursor:cursor(e),usuarioId};
 for(const ancla of [{...base.ancla,extra:true},{...base.ancla,dominio:"DECISION_PROOF"},
  {...base.ancla,firma:base.ancla.firma.slice(0,-2)},{...base.ancla,headHash:"f".repeat(64)}])assert.equal(verificar({...base,ancla}).valida,false);
 assert.equal(verificar({...base,usuarioId:"507f1f77bcf86cd799439099"}).valida,false);
 assert.equal(verificar({...base,clavePublica:privateKey}).valida,false);
 assert.equal(verificar({...base,clavePublica:crypto.generateKeyPairSync("ed25519").publicKey}).valida,false);
});
test("acepta crecimiento válido tras el ancla y rechaza truncamiento o cursor alterado",()=>{
 const e=evento(),segundo=eventoCompensatorio({original:{...original,montoMinor:900},tipo:"ANULACION",
  idempotencyKey:"anular",fechaISO:"2026-10-29T14:00:00.000Z",secuencia:2,prevHash:e.hashActual});
 const base={ancla:firmar(e),clavePublica:publicKey,eventos:[e,segundo],cursor:cursor(segundo),usuarioId};
 assert.equal(verificar(base).valida,true);
 assert.equal(verificar({...base,ancla:firmar(segundo),eventos:[e],cursor:cursor(e)}).valida,false);
 assert.equal(verificar({...base,cursor:{...cursor(segundo),hashActual:"f".repeat(64)}}).codigo,"CADENA_INVALIDA");
});
