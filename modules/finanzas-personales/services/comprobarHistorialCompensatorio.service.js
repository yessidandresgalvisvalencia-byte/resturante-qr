"use strict";
const {canon,originalVerificado,eventoCompensatorio,verificarCadena}=
 require("./eventoCompensatorioPersonal.service");
const GENESIS="0".repeat(64);
function inconsistente(){throw Object.assign(new Error("INTEGRIDAD_LEDGER: compensaciones contradictorias"),{statusCode:409});}
// Reconstruye cada movimiento únicamente desde eventos firmados. No prueba que
// el movimiento inicial existe en TransaccionPersonal; eso exige una lectura
// de la fuente original dentro de la futura transacción de escritura.
function comprobarHistorialCompensatorio(eventos,{usuarioId}={}){
 if(!Array.isArray(eventos)||typeof usuarioId!=="string"||
  !verificarCadena(eventos,{prevHash:GENESIS}))inconsistente();
 const actuales=new Map();
 for(const e of eventos){
  if(e.usuarioId!==usuarioId)inconsistente();
  let actual;
  try{
   const anterior=originalVerificado(e.original);
   const previo=actuales.get(e.movimientoId);
   if(previo?.anulado)inconsistente();
   if(previo&&canon(previo.actual)!==canon(anterior))inconsistente();
   const reconstruido=eventoCompensatorio({
    original:anterior,tipo:e.tipo,cambios:e.cambios,
    idempotencyKey:e.idempotencyKey,prevHash:e.prevHash,
    secuencia:e.secuencia,fechaISO:e.fechaISO
   });
   const campos=Object.keys(reconstruido);
   if(campos.some(k=>!Object.prototype.hasOwnProperty.call(e,k))||
    Object.keys(e).some(k=>k!=="_id"&&!campos.includes(k))||
    canon(reconstruido)!==canon(Object.fromEntries(campos.map(k=>[k,e[k]]))))inconsistente();
   actual=e.tipo==="ANULACION"?anterior:originalVerificado({...anterior,...e.cambios});
  }catch(_){inconsistente();}
  actuales.set(e.movimientoId,{actual,anulado:e.tipo==="ANULACION"});
 }
 return actuales;
}
module.exports={comprobarHistorialCompensatorio};
