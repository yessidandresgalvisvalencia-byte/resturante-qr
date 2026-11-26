"use strict";
const crypto=require("node:crypto"),shared=require("../../../public/finanzas-personales-registro-auditoria"),Aud=require("../security/contextoAuditoriaRegistroPersonal.service");
const error=()=>Object.assign(Error("INTEGRIDAD_REGISTRO: evidencia original no verificable"),{statusCode:409}),sha=v=>crypto.createHash("sha256").update(shared.canon(v)).digest("hex");
function crear(fuente,contexto){const datos=shared.datosFuente(fuente);Aud.validar(contexto,datos.usuarioId);if(contexto?.origen!=="HTTP_SOCKET")throw error();const p=shared.payload({usuarioId:datos.usuarioId,movimientoId:datos.movimientoId,fuenteHash:sha(datos),auditoriaCompromiso:Aud.compromiso(contexto)});return{auditoriaRegistro:{version:1,contexto},auditoriaRegistroHash:sha(p)};}
function verificar(fuente){
 const r=fuente.auditoriaRegistro,h=fuente.auditoriaRegistroHash;if(r===undefined&&h===undefined)return{estado:"SIN_CONTEXTO_CONSERVADO"};
 try{if(!r||Object.keys(r).sort().join(",")!=="contexto,version"||r.version!==1||typeof h!=="string"||! /^[a-f0-9]{64}$/.test(h))throw error();const datos=shared.datosFuente(fuente);Aud.validar(r.contexto,datos.usuarioId);if(r.contexto.origen!=="HTTP_SOCKET")throw error();const p=shared.payload({usuarioId:datos.usuarioId,movimientoId:datos.movimientoId,fuenteHash:sha(datos),auditoriaCompromiso:Aud.compromiso(r.contexto)});if(sha(p)!==h)throw error();return{estado:"CONTEXTO_CONSERVADO",...p,hashRegistro:h,datos,contextoAuditoria:Aud.resumen(r.contexto)};}catch{throw error();}
}
function opcionesCobroHttp(req){if(["auditoriaRegistro","auditoriaRegistroHash","auditoriaContexto","auditoriaCompromiso"].some(k=>Object.hasOwn(req.body||{},k)))throw Object.assign(Error("El contexto de registro lo obtiene el servidor"),{statusCode:400});return{capturarContexto:()=>Aud.capturar(req,req.personalAuth.userId)};}
function opcionesHttp(req){const o=opcionesCobroHttp(req);return["INGRESO","GASTO"].includes(req.validated?.tipo)?o:{};}
module.exports={crear,verificar,opcionesHttp,opcionesCobroHttp,sha};
