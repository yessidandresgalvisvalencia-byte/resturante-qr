"use strict";
const crypto=require("crypto");
function canonical(v){
 if(Array.isArray(v))return v.map(canonical);
 if(v&&typeof v==="object"&&!(v instanceof Date))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});
 return v instanceof Date?v.toISOString():v;
}
function crear({accion,evaluacion,verdades=[],actorId=null,corte=new Date(),idempotencyKey=null}){
 if(typeof accion!=="string"||!accion.trim())throw new TypeError("Acción obligatoria");
 if(!evaluacion||typeof evaluacion.autorizada!=="boolean")throw new TypeError("Evaluación de autorización obligatoria");
 const fecha=new Date(corte);if(Number.isNaN(fecha.getTime()))throw new TypeError("Fecha de decisión inválida");
 const cuerpo=canonical({version:1,accion:accion.trim(),autorizada:evaluacion.autorizada,irreversible:Boolean(evaluacion.irreversible),motivos:[...(evaluacion.motivos||[])].sort(),verdades,actorId:actorId?String(actorId):null,corte:fecha.toISOString(),idempotencyKey:idempotencyKey||null});
 const hash=crypto.createHash("sha256").update(JSON.stringify(cuerpo)).digest("hex");
 return Object.freeze({...cuerpo,hashAlgoritmo:"SHA-256",hash});
}
function verificar(prueba){
 if(!prueba||prueba.hashAlgoritmo!=="SHA-256"||typeof prueba.hash!=="string")return false;
 const {hash,hashAlgoritmo,...cuerpo}=prueba;
 const esperado=crypto.createHash("sha256").update(JSON.stringify(canonical(cuerpo))).digest("hex");
 return crypto.timingSafeEqual(Buffer.from(hash,"hex"),Buffer.from(esperado,"hex"));
}
module.exports={canonical,crear,verificar};
