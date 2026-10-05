"use strict";
const crypto=require("crypto");
function canonical(v){
 if(Array.isArray(v))return v.map(canonical);
 if(v&&typeof v==="object"&&!(v instanceof Date))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});
 return v instanceof Date?v.toISOString():v;
}
function cuerpoFirmado(x){
 const fecha=new Date(x.corte);if(Number.isNaN(fecha.getTime()))throw new TypeError("Fecha de decisión inválida");
 const version=x.version??1;if(![1,2].includes(version))throw new TypeError("Versión de DecisionProof no soportada");
 const base={version,accion:String(x.accion||"").trim(),autorizada:x.autorizada,irreversible:Boolean(x.irreversible),motivos:[...(x.motivos||[])].sort(),verdades:x.verdades||[],actorId:x.actorId?String(x.actorId):null,corte:fecha.toISOString(),idempotencyKey:x.idempotencyKey||null};
 if(version===2){if(!Number.isSafeInteger(x.secuencia)||x.secuencia<1)throw new TypeError("Secuencia inválida");if(x.previousHash!==null&&x.previousHash!==undefined&&!/^[a-f0-9]{64}$/.test(x.previousHash))throw new TypeError("previousHash inválido");base.previousHash=x.previousHash||null;base.secuencia=x.secuencia;}
 return canonical(base);
}
function crear({accion,evaluacion,verdades=[],actorId=null,corte=new Date(),idempotencyKey=null,version=1,previousHash=null,secuencia=null}){
 if(typeof accion!=="string"||!accion.trim())throw new TypeError("Acción obligatoria");
 if(!evaluacion||typeof evaluacion.autorizada!=="boolean")throw new TypeError("Evaluación de autorización obligatoria");
 const cuerpo=cuerpoFirmado({version,accion,autorizada:evaluacion.autorizada,irreversible:evaluacion.irreversible,motivos:evaluacion.motivos,verdades,actorId,corte,idempotencyKey,previousHash,secuencia});
 const hash=crypto.createHash("sha256").update(JSON.stringify(cuerpo)).digest("hex");
 return Object.freeze({...cuerpo,hashAlgoritmo:"SHA-256",hash});
}
function verificar(prueba){
 if(!prueba||prueba.hashAlgoritmo!=="SHA-256"||typeof prueba.hash!=="string"||!/^[a-f0-9]{64}$/.test(prueba.hash))return false;
 try{
  const cuerpo=cuerpoFirmado(prueba);
  const esperado=crypto.createHash("sha256").update(JSON.stringify(cuerpo)).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(prueba.hash,"hex"),Buffer.from(esperado,"hex"));
 }catch{return false;}
}
module.exports={canonical,cuerpoFirmado,crear,verificar};
