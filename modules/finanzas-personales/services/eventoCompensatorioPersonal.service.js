"use strict";
const crypto=require("node:crypto");
const HEX=/^[a-f0-9]{64}$/;
function canon(v){
 if(v===null||typeof v==="string"||typeof v==="boolean")return JSON.stringify(v);
 if(typeof v==="number"&&Number.isSafeInteger(v))return String(v);
 if(Array.isArray(v))return "["+v.map(canon).join(",")+"]";
 if(v&&typeof v==="object"&&Object.getPrototypeOf(v)===Object.prototype)
  return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canon(v[k])).join(",")+"}";
 throw new TypeError("Dato no determinístico o inseguro en evento");
}
function originalVerificado(o){
 if(!o||typeof o!=="object"||!["INGRESO","GASTO"].includes(o.tipo)||
  !Number.isSafeInteger(o.montoMinor)||o.montoMinor<=0||
  !/^[a-zA-Z0-9_-]{1,128}$/.test(o.usuarioId)||
  !/^[a-zA-Z0-9_-]{1,128}$/.test(o.movimientoId)||
  typeof o.concepto!=="string"||!o.concepto.trim()||
  typeof o.categoria!=="string"||!o.categoria.trim())throw new TypeError("Movimiento original no verificable");
 return Object.freeze({usuarioId:o.usuarioId,movimientoId:o.movimientoId,tipo:o.tipo,montoMinor:o.montoMinor,concepto:o.concepto,categoria:o.categoria});
}
function eventoCompensatorio({original,tipo,cambios={},idempotencyKey,prevHash,secuencia,fechaISO}){
 const anterior=originalVerificado(original);
 if(!["CORRECCION","ANULACION"].includes(tipo)||typeof idempotencyKey!=="string"||
  !/^[a-zA-Z0-9_-]{1,128}$/.test(idempotencyKey)||!HEX.test(prevHash)||
  !Number.isSafeInteger(secuencia)||secuencia<1||
  typeof fechaISO!=="string"||!/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/.test(fechaISO)||
  Number.isNaN(Date.parse(fechaISO))||new Date(fechaISO).toISOString()!==fechaISO)
  throw new TypeError("Encabezado del evento inválido");
 if(!cambios||typeof cambios!=="object"||Array.isArray(cambios)||Object.getPrototypeOf(cambios)!==Object.prototype)
  throw new TypeError("Cambios inválidos");
 const keys=Object.keys(cambios);
 if((tipo==="ANULACION"&&keys.length)||(tipo==="CORRECCION"&&!keys.length))
  throw new TypeError("Contenido de corrección o anulación inválido");
 const nuevo={...anterior};
 for(const key of keys){
  if(!["tipo","montoMinor","concepto","categoria"].includes(key))throw new TypeError("Campo no autorizado");
  const v=cambios[key];
  if(key==="montoMinor"&&(!Number.isSafeInteger(v)||v<=0))throw new TypeError("Importe inválido");
  if(key==="tipo"&&!["INGRESO","GASTO"].includes(v))throw new TypeError("Tipo inválido");
  if(["concepto","categoria"].includes(key)&&(typeof v!=="string"||!v.trim()))throw new TypeError("Texto inválido");
  nuevo[key]=v;
 }
 if(tipo==="CORRECCION"&&keys.every(k=>nuevo[k]===anterior[k]))throw new TypeError("Corrección sin efecto");
 const signed=o=>(o.tipo==="INGRESO"?1n:-1n)*BigInt(o.montoMinor);
 const delta=tipo==="ANULACION"?-signed(anterior):signed(nuevo)-signed(anterior);
 if(delta>BigInt(Number.MAX_SAFE_INTEGER)||delta<BigInt(Number.MIN_SAFE_INTEGER))
  throw new RangeError("Delta fuera de rango seguro");
 const payload={version:1,usuarioId:anterior.usuarioId,movimientoId:anterior.movimientoId,tipo,secuencia,fechaISO,
  idempotencyKey,prevHash,original:anterior,cambios:Object.freeze({...cambios}),deltaCajaMinor:String(delta)};
 const hashActual=crypto.createHash("sha256").update(canon(payload)).digest("hex");
 return Object.freeze({...payload,hashActual});
}
function verificarCadena(eventos,{prevHash,secuenciaInicial=1}={}){
 if(!Array.isArray(eventos)||!HEX.test(prevHash)||!Number.isSafeInteger(secuenciaInicial)||secuenciaInicial<1)
  throw new TypeError("Cadena inválida");
 let h=prevHash,s=secuenciaInicial;
 const claves=new Set();
 for(const e of eventos){
  if(!e||e.prevHash!==h||e.secuencia!==s||claves.has(e.idempotencyKey))return false;
  const {hashActual,...payload}=e;
  if(typeof hashActual!=="string"||!HEX.test(hashActual)||
   crypto.createHash("sha256").update(canon(payload)).digest("hex")!==hashActual)return false;
  claves.add(e.idempotencyKey);h=hashActual;s++;
 }
 return true;
}
module.exports={eventoCompensatorio,verificarCadena,canon};
