"use strict";
const {eventoCompensatorio,canon}=require("./eventoCompensatorioPersonal.service");
const GENESIS="0".repeat(64);
const HEX=/^[a-f0-9]{64}$/;
function fallo(){throw new Error("INTEGRIDAD_LEDGER: cadena compensatoria inconsistente");}
function auditarCompensaciones({usuarioId,originales,eventos,cursor}){
 if(typeof usuarioId!=="string"||!usuarioId||
  !Array.isArray(originales)||!Array.isArray(eventos)||!cursor)fallo();
 const estados=new Map();
 for(const o of originales){
  if(!o||o.usuarioId!==usuarioId||typeof o.movimientoId!=="string"||
   estados.has(o.movimientoId))fallo();
  estados.set(o.movimientoId,{actual:{...o},anulado:false});
 }
 let hash=GENESIS,secuencia=0;
 const claves=new Set();
 for(const e of eventos){
  if(!e||e.usuarioId!==usuarioId||e.secuencia!==secuencia+1||
   e.prevHash!==hash||!HEX.test(e.hashActual)||claves.has(e.idempotencyKey))fallo();
  const estado=estados.get(e.movimientoId);
  if(!estado||estado.anulado)fallo();
  let esperado;
  try{
   if(canon(e.original)!==canon(estado.actual))fallo();
   esperado=eventoCompensatorio({
    original:estado.actual,tipo:e.tipo,cambios:e.cambios,
    idempotencyKey:e.idempotencyKey,prevHash:hash,
    secuencia:e.secuencia,fechaISO:e.fechaISO
   });
  }catch(_){fallo();}
  const campos=Object.keys(esperado).sort();
  if(canon(esperado)!==canon(Object.fromEntries(campos.map(k=>[k,e[k]])))||
   Object.keys(e).some(k=>!campos.includes(k)))fallo();
  claves.add(e.idempotencyKey);
  if(e.tipo==="ANULACION")estado.anulado=true;
  else estado.actual={...estado.actual,...e.cambios};
  hash=e.hashActual;
  secuencia=e.secuencia;
 }
 if(cursor._id!==usuarioId||cursor.secuencia!==secuencia||cursor.hashActual!==hash)fallo();
 return Object.freeze({usuarioId,secuencia,hashActual:hash,
  estados:Object.freeze(Array.from(estados,([movimientoId,v])=>Object.freeze({
   movimientoId,anulado:v.anulado,actual:Object.freeze({...v.actual})
  })))});
}
module.exports={auditarCompensaciones};
