"use strict";
const crypto=require("node:crypto");
const {verificarCadena}=require("../services/eventoCompensatorioPersonal.service");
const {vigente}=require("../services/estadoCompensadoPersonal.service");
const DOMINIO="GRUK_COMPENSACIONES_PERSONALES_V1",GENESIS="0".repeat(64);
const campos=["algoritmo","dominio","emitidaEn","firma","headHash","secuencia","usuarioId","version"];
// Contrato para un firmante externo; no firma, publica ni almacena anclas.
function payloadAnclaCompensaciones(a){
 if(!a||a.version!==1||a.dominio!==DOMINIO||a.algoritmo!=="Ed25519"||
  typeof a.usuarioId!=="string"||!(/^[a-f0-9]{24}$/).test(a.usuarioId)||
  !Number.isSafeInteger(a.secuencia)||a.secuencia<1||a.secuencia>10000||
  typeof a.headHash!=="string"||!(/^[a-f0-9]{64}$/).test(a.headHash)||
  typeof a.emitidaEn!=="string"||!Number.isFinite(Date.parse(a.emitidaEn))||
  new Date(a.emitidaEn).toISOString()!==a.emitidaEn)throw new TypeError("Ancla compensatoria inválida");
 return Buffer.from(JSON.stringify({version:1,dominio:DOMINIO,algoritmo:"Ed25519",usuarioId:a.usuarioId,
  secuencia:a.secuencia,headHash:a.headHash,emitidaEn:a.emitidaEn}),"utf8");
}
function verificarAnclaCompensaciones({ancla,clavePublica,eventos,cursor,usuarioId}){
 const resultado=(valida,codigo,extra={})=>({valida,codigo,certificaCustodiaIndependiente:false,...extra});
 if(!(clavePublica instanceof crypto.KeyObject)||clavePublica.type!=="public"||clavePublica.asymmetricKeyType!=="ed25519")
  return resultado(false,"CLAVE_PUBLICA_NO_CONFIGURADA");
 if(typeof usuarioId!=="string"||!(/^[a-f0-9]{24}$/).test(usuarioId))return resultado(false,"USUARIO_INVALIDO");
 let cuerpo,firma;
 try{
  if(!ancla||Object.keys(ancla).sort().join(",")!==campos.join(",")||typeof ancla.firma!=="string")throw Error();
  cuerpo=payloadAnclaCompensaciones(ancla);firma=Buffer.from(ancla.firma,"base64");
  if(firma.length!==64||firma.toString("base64")!==ancla.firma)throw Error();
 }catch{return resultado(false,"ANCLA_INVALIDA");}
 if(!crypto.verify(null,cuerpo,clavePublica,firma))return resultado(false,"FIRMA_INVALIDA");
 if(ancla.usuarioId!==usuarioId)return resultado(false,"USUARIO_NO_COINCIDE");
 try{
  if(!Array.isArray(eventos)||eventos.length>10000||!cursor||cursor._id!==usuarioId||
   cursor.secuencia!==eventos.length||cursor.hashActual!==(eventos.at(-1)?.hashActual||GENESIS)||
   eventos.some(e=>e.usuarioId!==usuarioId)||!verificarCadena(eventos,{prevHash:GENESIS}))throw Error();
  const grupos=new Map();
  for(const e of eventos){const grupo=grupos.get(e.movimientoId)||[];grupo.push(e);grupos.set(e.movimientoId,grupo);}
  for(const grupo of grupos.values())vigente(grupo[0].original,grupo);
 }catch{return resultado(false,"CADENA_INVALIDA");}
 if(eventos.length<ancla.secuencia||eventos[ancla.secuencia-1].hashActual!==ancla.headHash)
  return resultado(false,"ANCLA_NO_COINCIDE");
 return resultado(true,"ANCLA_VERIFICADA",{secuenciaAnclada:ancla.secuencia});
}
module.exports={DOMINIO,payloadAnclaCompensaciones,verificarAnclaCompensaciones};
