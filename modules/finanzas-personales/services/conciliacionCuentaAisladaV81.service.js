"use strict";
const {conciliarCuentaV81}=require("./conciliacionCuentaV81.service");
// Proyección por cuenta explícita; no se aceptan movimientos de otra cuenta ni movimientos sin cuenta.
function conciliarCuentaAisladaV81({cuentaId,usuarioId,movimientos,cantidadEsperadaMovimientos,...saldos}={}){
 if(typeof cuentaId!=="string"||!cuentaId.trim()||typeof usuarioId!=="string"||!/^[a-f0-9]{24}$/i.test(usuarioId)||!Array.isArray(movimientos))
  throw new TypeError("Cuenta, usuario y movimientos obligatorios");
 if(cantidadEsperadaMovimientos!==undefined){
  if(!Number.isSafeInteger(cantidadEsperadaMovimientos)||cantidadEsperadaMovimientos<0)
   throw new TypeError("Cantidad esperada de movimientos inválida");
  if(movimientos.length!==cantidadEsperadaMovimientos)
   throw new Error("Conciliación incompleta: faltan movimientos de la cuenta");
 }
 const normalizados=movimientos.map(m=>{
  if(!m||m.cuentaId!==cuentaId||m.usuarioId!==usuarioId)
   throw new Error("Movimiento ajeno o sin cuenta: conciliación bloqueada");
  return {id:m.id,tipo:m.tipo,montoCentavos:m.montoCentavos};
 });
 const r=conciliarCuentaV81({...saldos,movimientos:normalizados});
 return Object.freeze({...r,cuentaId});
}
module.exports={conciliarCuentaAisladaV81};
