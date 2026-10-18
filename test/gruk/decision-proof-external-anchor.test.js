"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crear}=require("../../modules/finanzas-personales/services/decisionProof.service");
const {crearAncla,verificarAncla}=require("../../modules/finanzas-personales/security/anclaExternaDecision.service");
const KEY=Buffer.alloc(32,0x41);
const USER="0123456789abcdef01234567";
const TIME="2026-10-17T12:00:00.000Z";
function escenario(){
 const base={accion:"CONSULTAR",evaluacion:{autorizada:true,motivos:[]},corte:new Date(TIME),version:2};
 const primero=crear({...base,secuencia:1,previousHash:null,idempotencyKey:"decision-0001"});
 const segundo=crear({...base,secuencia:2,previousHash:primero.hash,idempotencyKey:"decision-0002"});
 return {registros:[{...primero,usuarioId:USER},{...segundo,usuarioId:USER}],head:{usuarioId:USER,secuencia:2,headHash:segundo.hash}};
}
test("ancla firmada comprueba el prefijo aun si la cadena creció",()=>{
 const {registros,head}=escenario();
 const ancla=crearAncla({usuarioId:USER,secuencia:1,headHash:registros[0].hash,emitidaEn:TIME},KEY);
 assert.deepEqual(verificarAncla(ancla,KEY,registros,head,USER),{valida:true,codigo:"ANCLA_VERIFICADA",secuenciaAnclada:1});
});
test("detecta firma falsificada y clave incorrecta",()=>{
 const {registros,head}=escenario();
 const ancla=crearAncla({usuarioId:USER,secuencia:2,headHash:head.headHash,emitidaEn:TIME},KEY);
 assert.equal(verificarAncla({...ancla,firma:"0".repeat(64)},KEY,registros,head,USER).codigo,"FIRMA_INVALIDA");
 assert.equal(verificarAncla(ancla,Buffer.alloc(32,0x42),registros,head,USER).codigo,"FIRMA_INVALIDA");
});
test("detecta cadena reescrita aunque head coincida con la cadena nueva",()=>{
 const {registros,head}=escenario();
 const ancla=crearAncla({usuarioId:USER,secuencia:2,headHash:head.headHash,emitidaEn:TIME},KEY);
 const nuevo=crear({accion:"SIMULAR",evaluacion:{autorizada:true,motivos:[]},corte:new Date(TIME),version:2,secuencia:2,previousHash:registros[0].hash,idempotencyKey:"decision-0002"});
 assert.equal(verificarAncla(ancla,KEY,[registros[0],{...nuevo,usuarioId:USER}],{usuarioId:USER,secuencia:2,headHash:nuevo.hash},USER).codigo,"ANCLA_NO_COINCIDE");
});
test("rechaza borrado completo del historial",()=>{
 const {head}=escenario();
 const ancla=crearAncla({usuarioId:USER,secuencia:2,headHash:head.headHash,emitidaEn:TIME},KEY);
 assert.equal(verificarAncla(ancla,KEY,[],{usuarioId:USER,secuencia:0,headHash:null},USER).codigo,"ANCLA_NO_COINCIDE");
 assert.equal(verificarAncla(ancla,KEY,[],{secuencia:0,headHash:null},USER).codigo,"PROPIETARIO_CADENA_NO_COINCIDE");
});
test("rechaza claves débiles y anclas con fecha inválida",()=>{
 const {head}=escenario();
 assert.throws(()=>crearAncla({usuarioId:USER,secuencia:1,headHash:head.headHash,emitidaEn:TIME},Buffer.alloc(8)),TypeError);
 assert.throws(()=>crearAncla({usuarioId:USER,secuencia:1,headHash:head.headHash,emitidaEn:"ayer"},KEY),TypeError);
});

test("rechaza ancla válida perteneciente a otra cuenta",()=>{
 const {registros,head}=escenario();
 const ancla=crearAncla({usuarioId:USER,secuencia:2,headHash:head.headHash,emitidaEn:TIME},KEY);
 const otroUsuario="abcdef0123456789abcdef01";
 assert.equal(verificarAncla(ancla,KEY,registros,head,otroUsuario).codigo,"USUARIO_NO_COINCIDE");
 assert.throws(()=>verificarAncla(ancla,KEY,registros,head),TypeError);
});
test("rechaza versión de ancla adulterada incluso con firma original",()=>{
 const {registros,head}=escenario();
 const ancla=crearAncla({usuarioId:USER,secuencia:2,headHash:head.headHash,emitidaEn:TIME},KEY);
 assert.equal(verificarAncla({...ancla,version:2},KEY,registros,head,USER).codigo,"ANCLA_INVALIDA");
});

test("rechaza campos adicionales que no están firmados por HMAC",()=>{
 const {registros,head}=escenario();
 const ancla=crearAncla({usuarioId:USER,secuencia:2,headHash:head.headHash,emitidaEn:TIME},KEY);
 assert.equal(verificarAncla({...ancla,administrador:true},KEY,registros,head,USER).codigo,"ANCLA_INVALIDA");
 assert.equal(verificarAncla({...ancla,emitidaEn:undefined},KEY,registros,head,USER).codigo,"ANCLA_INVALIDA");
});

test("rechaza el trasplante de una cadena de otro usuario aunque su ancla sea válida",()=>{
 const {registros,head}=escenario();
 const ancla=crearAncla({usuarioId:USER,secuencia:2,headHash:head.headHash,emitidaEn:TIME},KEY);
 const otro="abcdef0123456789abcdef01";
 assert.equal(verificarAncla(ancla,KEY,[{...registros[0],usuarioId:otro},registros[1]],head,USER).codigo,"PROPIETARIO_CADENA_NO_COINCIDE");
 assert.equal(verificarAncla(ancla,KEY,registros,{...head,usuarioId:otro},USER).codigo,"PROPIETARIO_CADENA_NO_COINCIDE");
 assert.equal(verificarAncla(ancla,KEY,registros.map(({usuarioId,...resto})=>resto),head,USER).codigo,"PROPIETARIO_CADENA_NO_COINCIDE");
});

test("ancla externa rechaza reescritura completa de una cadena autoconsistente",()=>{
 const {registros,head}=escenario();
 const ancla=crearAncla({usuarioId:USER,secuencia:2,headHash:head.headHash,emitidaEn:TIME},KEY);
 // Un atacante con acceso total a MongoDB puede reconstruir TODOS los hashes.
 // La cadena nueva se verifica internamente; el ancla firmada antigua no coincide.
 const base={accion:"RECONSTRUIDO",evaluacion:{autorizada:true,motivos:[]},corte:new Date(TIME),version:2};
 const primero=crear({...base,secuencia:1,previousHash:null,idempotencyKey:"decision-0001"});
 const segundo=crear({...base,secuencia:2,previousHash:primero.hash,idempotencyKey:"decision-0002"});
 const falsificados=[{...primero,usuarioId:USER},{...segundo,usuarioId:USER}];
 const headFalso={usuarioId:USER,secuencia:2,headHash:segundo.hash};
 const {verificarCadena}=require("../../modules/finanzas-personales/services/verificarCadenaDecision.service");
 assert.equal(verificarCadena(falsificados,headFalso,USER).valida,true);
 assert.equal(verificarAncla(ancla,KEY,falsificados,headFalso,USER).codigo,"ANCLA_NO_COINCIDE");
 assert.notEqual(registros[0].hash,primero.hash);
});
