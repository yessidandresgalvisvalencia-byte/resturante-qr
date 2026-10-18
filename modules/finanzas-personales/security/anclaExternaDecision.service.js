"use strict";

const crypto = require("node:crypto");

function validarClave(clave) {
 if (!Buffer.isBuffer(clave) || clave.length < 32) throw new TypeError("Clave HMAC de al menos 32 bytes obligatoria");
}
function validarHash(hash) {
 return typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash);
}
function payloadAncla({usuarioId, secuencia, headHash, emitidaEn}) {
 if (typeof usuarioId !== "string" || !/^[a-f0-9]{24}$/.test(usuarioId)) throw new TypeError("Usuario inválido");
 if (!Number.isSafeInteger(secuencia) || secuencia < 1) throw new TypeError("Secuencia inválida");
 if (!validarHash(headHash)) throw new TypeError("Hash inválido");
 if (typeof emitidaEn !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(emitidaEn) ||
     !Number.isFinite(Date.parse(emitidaEn)) || new Date(emitidaEn).toISOString() !== emitidaEn) {
  throw new TypeError("Fecha de ancla inválida");
 }
 return JSON.stringify({version:1,usuarioId,secuencia,headHash,emitidaEn});
}
function crearAncla({usuarioId,secuencia,headHash,emitidaEn=new Date().toISOString()},clave) {
 validarClave(clave);
 const cuerpo=payloadAncla({usuarioId,secuencia,headHash,emitidaEn});
 const firma=crypto.createHmac("sha256",clave).update(cuerpo).digest("hex");
 return Object.freeze({...JSON.parse(cuerpo),algoritmo:"HMAC-SHA256",firma});
}
/**
 * Firma exclusivamente una cadena v2 completa ya comprobada.
 * El llamador debe obtener registros y head de una instantánea confiable y
 * consistente de MongoDB; esta función no realiza consultas ni publica anclas.
 */
function crearAnclaVerificada({registros,head,usuarioId,emitidaEn=new Date().toISOString()},clave) {
 validarClave(clave);
 if (typeof usuarioId!=="string" || !/^[a-f0-9]{24}$/.test(usuarioId)) {
  throw new TypeError("Usuario esperado obligatorio");
 }
 if (!Array.isArray(registros) || registros.length===0 || !head) {
  throw new Error("CADENA_NO_VERIFICABLE");
 }
 const {verificarCadena}=require("../services/verificarCadenaDecision.service");
 const resultado=verificarCadena(registros,head,usuarioId);
 if (!resultado.valida) {
  const error=new Error("CADENA_NO_VERIFICABLE");
  error.code=resultado.codigo;
  throw error;
 }
 return crearAncla({usuarioId,secuencia:head.secuencia,headHash:head.headHash,emitidaEn},clave);
}

function verificarAncla(ancla,clave,registros,head,usuarioEsperado) {
 if (typeof usuarioEsperado !== "string" || !/^[a-f0-9]{24}$/.test(usuarioEsperado)) throw new TypeError("Usuario esperado obligatorio");
 validarClave(clave);
 if (!ancla || ancla.version!==1 || ancla.algoritmo!=="HMAC-SHA256" || !validarHash(ancla.firma)) return {valida:false,codigo:"ANCLA_INVALIDA"};
 // No aceptar metadatos adicionales no cubiertos por la firma HMAC.
 // Evita que los consumidores confíen accidentalmente en campos falsificables.
 const campos=["algoritmo","emitidaEn","firma","headHash","secuencia","usuarioId","version"];
 if (Object.keys(ancla).sort().join(",")!==campos.join(",")) {
  return {valida:false,codigo:"ANCLA_INVALIDA"};
 }
 let cuerpo;
 try { cuerpo=payloadAncla(ancla); } catch {return {valida:false,codigo:"ANCLA_INVALIDA"};}
 const firma=crypto.createHmac("sha256",clave).update(cuerpo).digest();
 if (!crypto.timingSafeEqual(firma,Buffer.from(ancla.firma,"hex"))) return {valida:false,codigo:"FIRMA_INVALIDA"};
 if (ancla.usuarioId!==usuarioEsperado) return {valida:false,codigo:"USUARIO_NO_COINCIDE"};
 if (!Array.isArray(registros) || !head || !Number.isSafeInteger(head.secuencia)) return {valida:false,codigo:"CADENA_INVALIDA"};
 // La firma autentica el ancla; la titularidad de los registros proviene de
 // MongoDB y debe verificarse de forma independiente para evitar trasplantes.
 if (String(head.usuarioId ?? "") !== usuarioEsperado ||
     registros.some(registro => String(registro?.usuarioId ?? "") !== usuarioEsperado)) {
  return {valida:false,codigo:"PROPIETARIO_CADENA_NO_COINCIDE"};
 }
 // La cadena completa debe verificarse primero, incluyendo su cabeza actual.
 const {verificarCadena}=require("../services/verificarCadenaDecision.service");
 if (!verificarCadena(registros,head).valida) return {valida:false,codigo:"CADENA_INVALIDA"};
 if (registros.length < ancla.secuencia || registros[ancla.secuencia-1].hash !== ancla.headHash)
  return {valida:false,codigo:"ANCLA_NO_COINCIDE"};
 return {valida:true,codigo:"ANCLA_VERIFICADA",secuenciaAnclada:ancla.secuencia};
}
module.exports={crearAncla,crearAnclaVerificada,verificarAncla};
